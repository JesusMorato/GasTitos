# Modelo de datos

Todas las tablas están en el esquema `public` de Supabase con RLS activado.

## Tablas

### households — la pareja
| columna | tipo | notas |
|---|---|---|
| id | uuid | clave |
| name | text | "Casa de Ana y Luis" |
| invite_code | text | 8 caracteres, único, para que se una la segunda persona |

### household_members — quién está en qué hogar
| columna | tipo | notas |
|---|---|---|
| household_id | uuid | → households |
| user_id | uuid | → auth.users, **único** (un usuario solo puede estar en un hogar) |
| display_name | text | nombre que ve la pareja |

Trigger `household_members_max_two`: no admite un tercer miembro.

### expenses — gastos
| columna | tipo | notas |
|---|---|---|
| household_id | uuid | hogar al que pertenece |
| user_id | uuid | quién lo ha pagado. Si es individual, su dueño |
| amount | numeric(12,2) | > 0 |
| spent_on | date | |
| category | text | lista fija en `src/types.ts` |
| description | text | opcional |
| is_shared | bool | true = gasto de la pareja |
| is_public | bool | solo aplica a individuales: visible para la pareja |

### savings_goals — objetivos de ahorro
Mismas columnas de pertenencia y visibilidad que `expenses`, más `name`,
`target_amount` y `deadline` (opcional).

### goal_contributions — aportaciones a un objetivo
`goal_id` → savings_goals, `user_id` (quien aporta), `amount`, `contributed_on`, `note`.

### schema_migrations
Registro de qué archivos de `supabase/migrations/` se han aplicado. Sin políticas:
solo accesible con la conexión directa del workflow.

## Reglas de visibilidad (RLS)

Función `current_household_id()`: devuelve el hogar del usuario autenticado.

| Tabla | Ver | Crear | Editar / borrar |
|---|---|---|---|
| households | mi hogar | solo vía `create_household()` | miembros |
| household_members | los de mi hogar | solo vía `create_household()` / `join_household()` | mi propia fila |
| expenses | de mi hogar y (compartido **o** mío **o** público) | en mi hogar; pagador debe ser miembro; si es individual, yo | de mi hogar y (compartido **o** mío) |
| savings_goals | igual que expenses | en mi hogar y mío | igual que expenses |
| goal_contributions | si veo el objetivo | si puedo editar el objetivo, y la aportación es mía | mía y objetivo editable por mí |

Consecuencias prácticas:

- Un gasto **personal privado** solo existe para su dueño. La pareja ni lo ve ni
  sabe que existe.
- Al marcarlo **público**, la pareja lo ve (y sus aportaciones, si es un objetivo)
  pero cualquier intento de editarlo se rechaza en la base de datos.
- Lo **compartido** lo ven y editan los dos.
- Un usuario **sin hogar** no ve ninguna fila de ninguna tabla.

## Funciones (RPC)

- `create_household(p_name, p_display_name)` → crea el hogar y mete al usuario.
- `join_household(p_code, p_display_name)` → une al usuario al hogar del código.

Ambas fallan si el usuario ya pertenece a un hogar o si el hogar ya tiene dos
miembros.

## Añadido en 0002 (fase 1: reparto real)

### categories — categorías del hogar
`name`, `emoji`, `color`, `icon`, `sort_order`. Únicas por hogar y nombre. Se siembran 10 por
defecto al crear el hogar. Los dos miembros pueden editarlas. No se puede borrar una
categoría con gastos (FK restrict).

`icon` (añadido en 0004) es la clave de un icono del juego propio de GasTitos
(`casa`, `comida`, `transporte`, `ocio`, `salud`, `ropa`, `regalos`, `viajes`,
`suscripciones`, `otros`; ver `src/lib/icons.ts`). Si es `null`, la app dibuja el
`emoji`. Las 10 categorías de serie llevan icono y el color de la paleta que le
corresponde a cada uno.

### household_members.share_pct
Porcentaje de reparto por defecto de cada miembro (50 por defecto). Se cambia con la
función `set_household_split(p_my_pct)`, que ajusta el del otro para sumar 100.

### expenses: nuevas columnas
| columna | valores | significado |
|---|---|---|
| category_id | → categories | sustituye al texto `category` |
| funding | `personal` \| `pot` | con qué dinero se pagó: del pagador o de la cuenta conjunta |
| split_mode | `household` \| `equal` \| `custom` \| `exact` \| `other_only` | cómo se repartió (solo informativo; las partes reales están en expense_shares) |

Tipos de gasto resultantes:
- **Personal:** `is_shared=false`. `user_id` = dueño.
- **Repartido:** `is_shared=true, funding='personal'`. `user_id` = quién pagó. Partes en `expense_shares`.
- **Del bote:** `is_shared=true, funding='pot'`. `user_id` = quién lo apuntó. Sin partes. No entra en el balance.

### expense_shares — cuánto le toca a cada uno
`(expense_id, user_id, amount)`. Solo se escriben a través de `save_expense()`, que
valida que las partes sumen el importe. Se ven si se ve el gasto.

### settlements — pagos entre la pareja
`from_user`, `to_user`, `amount`, `settled_on`, `note`. Los ven y borran los dos; los
crea cualquiera de los dos siempre que sea parte del pago.

### Balance
`net[persona] = Σ pagado en repartidos − Σ su parte + Σ pagos hechos − Σ pagos recibidos`.
Con dos personas es un solo número con signo. Cálculo en `src/lib/money.ts` (`computeBalance`), testeado.

### save_expense(p jsonb)
Única forma de crear/editar gastos desde la app. Recibe el gasto y sus partes y lo guarda
todo en una transacción. Comprueba: hogar, categoría, pagador miembro, partes de miembros
y suma exacta.

## Añadido en 0005 (fase 3: límites mensuales)

### budgets — límite de gasto al mes
| columna | notas |
|---|---|
| scope | `personal` (uno por usuario, privado) o `pot` (uno por hogar, común) |
| user_id | dueño si es personal; null si es del bote |
| monthly_limit | > 0 |

Único por (hogar, ámbito, usuario). Se lee con RLS (el del bote lo ven los dos, el
personal solo su dueño) y se escribe solo con `set_budget(p_scope, p_limit)`:
crea o actualiza; con `p_limit` null o 0 lo borra.

El límite personal se compara con "lo mío": gastos personales + mi parte de los
repartidos. El del bote, con los gastos pagados con la cuenta conjunta.
Cálculos en `src/lib/money.ts` (`cumulativeByDay`, `budgetStatus`, `dayCursor`),
testeados.
