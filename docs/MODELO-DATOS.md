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
