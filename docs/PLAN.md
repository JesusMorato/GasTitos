# GasTitos · Plan de producto v2

Fecha: 2026-09-15. Estado: propuesta para decidir y ejecutar por fases.

## 0. La idea en una frase

GasTitos es la app de una pareja para tres cosas: **repartir** lo que uno paga por
los dos (como Splitwise), **gestionar el bote común** (la cuenta conjunta) y
**ahorrar**, cada uno por su lado y juntos para cosas como un viaje. Todo lo
personal es privado salvo que su dueño lo enseñe.

---

## 1. Estado del arte: qué hacen bien las apps de referencia

He revisado las apps más usadas en tres categorías. De cada una me quedo con lo
que aplica a una pareja y descarto lo que es para grupos grandes o exige conectar
bancos.

### 1.1 Reparto de gastos en grupo (Splitwise, Tricount, Settle Up)

| App | Lo que hace bien | Lo que copiamos |
|---|---|---|
| **Splitwise** | Formas de repartir: iguales, porcentajes, partes, importes exactos, ajustes. Gastos recurrentes. "Settle up" registra el pago y pone el balance a cero. Notas y foto de ticket. | Los cinco modos de reparto, el botón **Saldar**, gastos recurrentes. |
| **Tricount** | Interfaz mínima: añadir gasto en 3 toques. Pantalla "Balances" con una barra por persona. Funciona sin cuenta, offline. Sin anuncios ni plan de pago. | La pantalla de balances y la obsesión por que apuntar un gasto sea rapidísimo. |
| **Settle Up** | Repartos ponderados y varios pagadores en un mismo gasto. Exportar CSV. Web real, no solo móvil. | Exportar CSV. Pesos por persona (nuestro "porcentaje del hogar"). |

**Lo que NO copiamos:** "simplificar deudas" (con dos personas solo hay un balance
posible), multi-moneda, grupos con N personas, integración con Venmo/Bizum.

**Idea clave para GasTitos:** el balance de pareja es un único número con signo.
"Ana debe 42,50 € a Luis" o "Estáis en paz". Todo lo demás es detalle.

### 1.2 Finanzas en pareja (Honeydue, Zeta, Monarch, Spendee)

| App | Lo que hace bien | Lo que copiamos |
|---|---|---|
| **Honeydue** | Cada uno decide qué cuentas ve el otro (privacidad granular). Recordatorios de facturas. Chat dentro del gasto. Gratis. | La privacidad por elemento, que ya tenemos. Comentarios en un gasto (fase tardía). |
| **Zeta** | Cuenta conjunta + vista personal en la misma app. Reparto de facturas sin fusionar el dinero. "Cuánto pone cada uno" al bote. | El concepto de **bote común con aportaciones** de cada uno y saldo visible. |
| **Monarch** | Panel del hogar: gasto total, por categoría, flujo de caja mensual, tendencia. Todo bajo una suscripción para los dos. | La estructura del panel resumen: cifra grande arriba, categorías debajo, tendencia al final. |
| **Spendee** | Carteras compartidas: se ve quién gasta qué dentro de la cartera común. Gráficas claras. | El desglose "quién ha gastado qué" dentro del bote. |

**Lo que NO copiamos:** conexión bancaria automática. En España exige licencia
PSD2 y es lo que más falla en Fintonic. GasTitos es de apunte manual: por eso
añadir un gasto tiene que costar tres toques.

### 1.3 Ahorro (YNAB, N26 Spaces, Revolut Vaults, Plum, Qapital, Monefy)

| App | Lo que hace bien | Lo que copiamos |
|---|---|---|
| **YNAB** | Tres tipos de objetivo: "cantidad para una fecha", "saldo a mantener" y "aportar X cada mes sin fecha". Calcula cuánto te falta asignar este mes para ir al ritmo. | Los tipos de hucha y la cifra **"este mes te toca poner X"**. |
| **N26 Spaces** | Cada objetivo es un sub-espacio con nombre, imagen y % completado. Arrastrar dinero entre espacios. Reglas de transferencia recurrente. Espacios compartidos. | Las **huchas** con emoji y anillo de progreso. Aportación recurrente. Huchas compartidas (objetivo de viaje). |
| **Revolut Vaults/Pockets** | Redondeo de compras al euro y guardar la diferencia. Transferencia recurrente. Separación entre "presupuesto" y "ahorro". | El **redondeo** como sugerencia al apuntar un gasto (manual, no automático). |
| **Plum / Chip** | Calculan solos cuánto puedes ahorrar mirando ingresos y gastos. Nudges. | La cifra "podrías ahorrar X este mes" = ingresos − gastos − aportaciones ya hechas. |
| **Qapital** | Reglas: "cada vez que pido comida a domicilio, guardo 5 €". Reto de 52 semanas. | Retos opcionales: 52 semanas y "regla del gasto culpable". Fase tardía. |
| **Monefy** | Un único donut central por categoría, con el total en medio. Apunte en dos toques. | El donut como gráfica principal del mes. |

### 1.4 Gráficas que aparecen en todas y que funcionan

1. **Donut por categoría** del mes, con el total en el centro. La más usada.
2. **Barras de los últimos 6-12 meses** con una línea de media. Enseña tendencia.
3. **Anillo o barra de progreso** por objetivo, con % y "faltan X".
4. **Línea acumulada real vs plan** para un objetivo: ves si vas por delante o por detrás.
5. **Barras apiladas por persona** en los gastos repartidos: quién ha pagado cuánto.
6. **Tasa de ahorro mensual** (ahorrado / ingresos) en barras. Solo si se registran ingresos.
7. **Línea de saldo del bote** a lo largo del tiempo.

Descartado: heatmaps de calendario, sankey de flujos, patrimonio neto. Vistosos,
pero nadie los mira cada semana. El principio que repiten las guías de diseño de
paneles financieros: *una gráfica que miras cada semana vale más que diez que
miras una vez.*

---

## 2. Cómo queda GasTitos: modelo conceptual

### 2.1 Dos espacios, seis apartados

```
YO                                  PAREJA
├─ Resumen (mi mes)                 ├─ Repartidos (tipo Splitwise)
├─ Gastos (míos + mi parte)         ├─ Bote común (cuenta conjunta)
└─ Ahorro (huchas, la función ⭐)   └─ Objetivos juntos (viaje…)
```

Navegación inferior en móvil: **Yo · ➕ · Pareja**. El botón central abre un menú
rápido con cuatro acciones: gasto personal, gasto repartido, gasto del bote,
aportar a una hucha.

### 2.2 Los tres tipos de gasto

| Tipo | Quién lo paga | Cómo se reparte | Dónde aparece |
|---|---|---|---|
| **Personal** | Yo, con mi dinero | No se reparte | Yo → Gastos. Privado salvo candado. |
| **Repartido** | Uno de los dos, con su dinero | Según regla (ver 2.3) | Pareja → Repartidos. Mi parte suma en Yo. |
| **Del bote** | La cuenta conjunta | No se reparte: ya lo pagó el bote | Pareja → Bote. En Yo cuenta lo que aporto al bote, no el gasto. |

Esta separación evita contar dos veces: lo que sale del bote no vuelve a
aparecer como gasto mío. Lo que sí aparece en mi mes es **mi aportación al bote**,
que es el dinero que de verdad salió de mi cuenta.

### 2.3 Regla de reparto

- El hogar tiene un **porcentaje por defecto** por persona (50/50, o 60/40 si uno
  gana más). Se cambia en Ajustes del hogar.
- Cada gasto repartido puede usar: *porcentaje del hogar* (por defecto), *a
  medias*, *porcentaje a medida*, *importes exactos* o *solo el otro* (te lo pagué
  yo entero, me lo debes).
- Internamente cada gasto repartido guarda **cuánto le toca a cada uno** (dos
  filas). El balance es: Σ (lo que pagué) − Σ (lo que me tocaba). Un solo número.
- **Saldar:** registra "Ana pagó 42,50 € a Luis el día X" y el balance vuelve a
  cero. Historial de liquidaciones visible.

### 2.4 Bote común

- **Saldo** = aportaciones − gastos pagados con el bote.
- **Aportaciones** de cada uno con fecha (cuando hacéis la transferencia a la
  cuenta conjunta). Se puede fijar una aportación mensual esperada por persona
  (según el porcentaje del hogar) y la app avisa de quién va por debajo.
- Gastos del bote por categoría y por mes, con el donut.
- Gráfica de saldo del bote en el tiempo.

### 2.5 Ahorro (la función principal de Yo)

**Huchas** (savings goals) con emoji, color y uno de tres tipos, copiados de YNAB:

| Tipo | Ejemplo | Qué calcula la app |
|---|---|---|
| **Cantidad para una fecha** | Portátil, 1.200 € antes de junio | Plan mensual = (objetivo − ahorrado) / meses que quedan. Proyección de fecha al ritmo real de los últimos 3 meses. Estado: en ritmo / atrasado. |
| **Aportar X al mes** | Colchón: 150 €/mes sin fin | Si este mes has puesto los 150 €. Racha de meses cumplidos. |
| **Saldo a mantener** | Emergencias: mantener 3.000 € | Cuánto falta para reponer tras sacar dinero. |

Movimientos de hucha: **aportar** y **sacar** (con nota). Aportaciones
**recurrentes** (día del mes, importe) que se crean solas.

Panel de Ahorro:
- Cifra grande: **total ahorrado** en todas mis huchas.
- **"Este mes te toca poner X"** (suma de los planes mensuales) y cuánto llevas.
- **"Podrías ahorrar X"** = ingresos del mes − gastos − aportaciones ya hechas
  (solo si registras ingresos).
- Lista de huchas con anillo de progreso.
- Gráfica: línea acumulada real vs plan de la hucha elegida; barras de ahorro
  mensual de los últimos 12 meses.

Extras opcionales (fase tardía): **redondeo** (al apuntar un gasto de 7,30 € la
app propone guardar 0,70 € en la hucha por defecto), **reto 52 semanas** y
**regla del gasto culpable** ("cada gasto en Comida a domicilio, 3 € a la hucha").

Todo lo de Ahorro es privado por defecto. El candado por hucha ya existe.

### 2.6 Objetivos en pareja

Son huchas con `is_shared = true`. Añaden: quién ha aportado cuánto (barras por
persona), plan mensual repartido según el porcentaje del hogar, y estado por
persona ("a Ana le tocaba 100 € y ha puesto 50 €"). Caso típico: viaje.

### 2.7 Ingresos y presupuesto (opcionales)

- **Ingresos** personales (nómina, extra). Privados. Sirven para la tasa de
  ahorro y para "podrías ahorrar X". Si no los registras, esas dos cifras no se
  muestran y todo lo demás funciona igual.
- **Presupuesto por categoría** mensual personal ("Ocio: 150 €"), con barra de
  consumo y aviso al 80 % y 100 %. Ligero, sin sobres al estilo YNAB.

---

## 3. Cambios de base de datos (migraciones futuras)

| Migración | Qué añade |
|---|---|
| 0002_reparto | `household_members.share_pct` (por defecto 50). `expenses.funding` ('personal' \| 'pot'). Tabla `expense_shares(expense_id, user_id, amount)` con la parte de cada uno. Tabla `settlements(from_user, to_user, amount, settled_on, note)`. |
| 0003_bote | Tabla `pot_contributions(user_id, amount, contributed_on, note)`. `households.pot_monthly_target` opcional. |
| 0004_ahorro | En `savings_goals`: `emoji`, `color`, `kind` ('target' \| 'builder' \| 'balance'), `monthly_plan`, `archived_at`. En `goal_contributions`: `direction` ('in' \| 'out'). |
| 0005_recurrentes | Tabla `recurring_rules(kind, template jsonb, day_of_month, next_run_on, active)`. Función `run_due_rules()` que las ejecuta. Se llama al abrir la app (y opcionalmente con pg_cron cada noche). |
| 0006_ingresos_presupuesto | Tablas `incomes` y `budgets`. |
| 0007_extras | `expense_comments`, reglas de redondeo y retos. |

Todas con RLS igual que ahora: solo mi hogar; lo individual solo su dueño salvo
público. `expense_shares` y `settlements` son de hogar (los ven los dos).

---

## 4. Gráficas: librería y catálogo

**Librería:** Chart.js con `vue-chartjs`. Pesa poco (~60 KB), tiene donut,
barras, líneas y anillos, y funciona bien en móvil. Alternativa si queremos más
control: SVG a mano para los anillos de progreso (ya lo hacemos con barras).

| Dónde | Gráfica | Datos |
|---|---|---|
| Yo → Resumen | Donut por categoría del mes (total en el centro) | gastos personales + mi parte de repartidos + mis aportaciones al bote |
| Yo → Resumen | Barras 6 meses con línea de media | mismo agregado, por mes |
| Yo → Ahorro | Anillo por hucha | ahorrado / objetivo |
| Yo → Ahorro | Línea acumulada real vs plan | movimientos de la hucha |
| Yo → Ahorro | Barras ahorro mensual 12 meses (+ tasa si hay ingresos) | aportaciones netas por mes |
| Pareja → Repartidos | Barras apiladas por persona (pagado por cada uno) | gastos repartidos por mes |
| Pareja → Bote | Línea de saldo + donut por categoría | aportaciones y gastos del bote |
| Pareja → Objetivos | Anillo + barras por persona | aportaciones por miembro |

---

## 5. Pantallas (boceto)

### Yo → Resumen
```
Septiembre 2026                                   ‹ ›
┌───────────────────────────────────────────────┐
│  Gastado este mes             1.234,56 €       │
│  Personal 640 · Mi parte 420 · Al bote 175     │
│         [ donut por categoría ]                │
│  Ocio 310 · Comida 280 · Transporte 190 …      │
├───────────────────────────────────────────────┤
│  Ahorro                       ▶ ver huchas     │
│  Este mes te toca poner 250 € · llevas 150 €   │
│  🏖️ Viaje 62 % · 💻 Portátil 30 % · 🛟 Colchón │
├───────────────────────────────────────────────┤
│  [ barras últimos 6 meses ]                    │
└───────────────────────────────────────────────┘
```

### Yo → Ahorro
```
Total ahorrado                  4.320,00 €
Este mes: 150 € de 250 € planificados   ▮▮▮▮▮▯▯▯
Podrías ahorrar 310 € más (ingresos − gastos)

🏖️ Viaje a Japón        ◔ 62 %   1.860 / 3.000 €
   plan 190 €/mes · a este ritmo: mayo 2027 ✅
💻 Portátil              ◔ 30 %     360 / 1.200 €
   plan 140 €/mes · a este ritmo: nov 2027 ⚠️ atrasado
🛟 Colchón (150 €/mes)   racha 4 meses ✅
[+ Nueva hucha]                     [ línea real vs plan ]
```

### Pareja → Repartidos
```
Balance:  Ana debe 42,50 € a Luis          [Saldar]
Septiembre: 890 € · Ana pagó 510 · Luis pagó 380
[ barras apiladas por persona, 6 meses ]
Lista de gastos (quién pagó · cómo se repartió)
Historial de liquidaciones
```

### Pareja → Bote
```
Saldo del bote   612,40 €        [Aportar] [Gasto del bote]
Este mes: Ana ha puesto 400 / 400 ✅ · Luis 300 / 400 ⚠️
Gastos del bote: 987 €   [ donut ]
[ línea de saldo 12 meses ]
```

### Pareja → Objetivos juntos
Igual que Ahorro pero con barras por persona y plan repartido.

---

## 6. Hoja de ruta por fases

Cada fase es un paquete que se puede pedir en una o dos sesiones. Al terminar cada
una: tests en verde, build correcto, push, documentación actualizada.

| Fase | Contenido | Tamaño | Criterio de "hecho" |
|---|---|---|---|
| **0. Prueba de humo** | Las dos cuentas entran, se unen, apuntan gastos, candado funciona. Arreglar lo que salga. | S | Lista de bugs cerrada. |
| **1. Reparto real** | Porcentaje del hogar en Ajustes. Modos de reparto por gasto. `expense_shares`. Balance con signo. Botón Saldar + historial. | M | "Ana debe X a Luis" es correcto con repartos mixtos y se pone a cero al saldar. |
| **2. Bote común** | Aportaciones, gastos del bote, saldo, esperado mensual por persona, donut del bote. | M | El saldo cuadra con aportaciones − gastos. |
| **3. Mi mes real** | Yo → Resumen con el agregado (personal + mi parte + al bote). Donut y barras 6 meses. Chart.js. | M | La cifra del mes coincide con lo que sale de mi cuenta. |
| **4. Ahorro v2** ⭐ | Huchas con emoji, tipos YNAB, plan mensual, proyección, sacar dinero, "este mes te toca X", gráfica real vs plan, barras 12 meses. | L | Un objetivo con fecha muestra plan y proyección correctos. |
| **5. Recurrentes** | Reglas mensuales para gastos fijos, aportaciones al bote y a huchas. Ejecución al abrir la app. | M | El alquiler aparece solo el día 1. |
| **6. Objetivos en pareja v2** | Barras por persona, plan repartido, estado por persona. | S | Se ve quién va por debajo del plan. |
| **7. Ingresos y presupuesto** | Ingresos privados, tasa de ahorro, "podrías ahorrar X", presupuestos por categoría con avisos. | M | Tasa de ahorro correcta; aviso al pasar el 80 %. |
| **8. Calidad de vida** | PWA instalable con icono, modo oscuro, exportar CSV, navegación inferior con botón ➕. | M | Instalada en el móvil, funciona en oscuro. |
| **9. Extras** | Redondeo, reto 52 semanas, comentarios en gastos, login con Google. | S cada uno | A demanda. |

Tamaños: S = una sesión corta, M = una sesión larga o dos, L = dos o tres.

**Orden recomendado:** 0 → 1 → 3 → 4 → 2 → 5 → 8 → 6 → 7 → 9. El reparto (1) y
el mes real (3) son la base sobre la que se calcula todo lo demás; el ahorro (4)
es la función estrella y conviene tenerla pronto para usarla de verdad; el bote
(2) puede esperar si aún no tenéis cuenta conjunta activa.

---

## 7. Decisiones que tienes que tomar tú

1. **Porcentaje por defecto:** ¿50/50 o proporcional a ingresos? (Se puede
   cambiar después, pero afecta a cómo se guardan los gastos desde el día uno.)
2. **Bote:** ¿registráis las aportaciones reales (transferencias) o solo queréis
   apuntar los gastos que salen de la cuenta conjunta? Sin aportaciones no hay
   saldo, solo gasto.
3. **Ingresos:** ¿los registráis? Sin ellos no hay tasa de ahorro ni "podrías
   ahorrar X". Todo lo demás funciona.
4. **Ahorro compartido:** cuando uno aporta al viaje, ¿cuenta como "su parte" o
   se reparte según el porcentaje del hogar?
5. **Retos y redondeo:** ¿os motivan o son ruido? Si son ruido, se quedan fuera.

Con las respuestas a 1 y 2 puedo empezar la fase 1 en la siguiente sesión.

---

## Fuentes consultadas

- Splitwise: [modos de reparto y recurrentes](https://usefairsplit.com/comparisons/what-is-splitwise/), [free vs pro 2026](https://www.areweeven.com/blog/splitwise-free-vs-pro-2026), [simplify debts](https://www.splitwise.com/l/sdv/c1mHsiFUb9x)
- Tricount / Settle Up: [comparativa 2026](https://splitpilot.io/blog/tricount-vs-splitwise/), [alternativas source-checked](https://dolio.org/compare/splitwise-alternatives), [Tricount vs Splitwise vs Settle Up](https://tetras-ltd.com/en/blog/tricount-vs-splitwise-vs-settle-up-best-app)
- Parejas: [10 mejores apps para parejas 2026](https://useorigin.com/resources/blog/10-best-budgeting-apps-for-couples-in-2026), [guía Honeydue/Zeta/Monarch](https://www.moonproduct.tech/insights/best-couples-finance-apps-2026/), [Hearth blog](https://hearthbudget.com/blog/best-budgeting-apps-for-couples)
- Ahorro: [YNAB goal tracking](https://www.ynab.com/features/goal-tracking), [YNAB smarter goals](https://www.ynab.com/blog/budget-smarter-with-smarter-goals), [Revolut Pockets](https://www.revolut.com/blog/post/meet-pockets-the-next-evolution-of-vaults/), [N26 vs Revolut](https://www.twobirdsbreakingfree.com/n26-vs-revolut-comparison-guide), [Plum vs Chip 2026](https://firststepsavings.com/chip-vs-plum-uk/), [apps de auto-ahorro](https://due.com/automatic-saving-apps/)
- España: [apps para ahorrar 2026](https://www.publico.es/ahorro-inteligente/mejores-apps-empezar-ahorrar-2026.html), [alternativas a Fintonic](https://banktrack.com/blog/alternativas-fintonic)
- Paneles y gráficas: [7 gráficas esenciales](https://www.syncfusion.com/blogs/post/financial-charts-visualization), [dashboard que tiene sentido](https://www.wealthnx.ai/blog/how-to-build-a-personal-finance-dashboard-that-actually-makes-sense/), [qué hace un panel por ti](https://www.fintrackai.app/blog/personal-finance-dashboard)
