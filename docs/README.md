# GasTitos · documentación del proyecto

## Qué es

Una app web para que una pareja apunte gastos y se ponga objetivos de ahorro.

- **Vista Pareja:** gastos compartidos del mes, balance de quién debe a quién
  (a medias), objetivos comunes con aportaciones, y una sección con lo que la otra
  persona ha decidido hacer público.
- **Vista Yo:** gastos y objetivos personales. Privados por defecto. Cada elemento
  se puede hacer público (en los gastos, desde el menú de los tres puntos): la pareja lo ve pero no lo
  edita.

Dirección pública: https://jesusmorato.github.io/GasTitos/

## Estado

**2026-09-16 · v0.4 — gastos fijos, huchas simples, cuenta conjunta e identidad.**

- Migración `0006_fijos_y_huchas.sql`: tablas `recurring_expenses` y `recurring_runs`,
  funciones `run_recurring`, `resolve_pending`, `skip_pending`; huchas con objetivo
  opcional y movimientos de salida.
- **Gastos fijos** (Ajustes → Gastos fijos): sin día del mes. Al entrar en un mes nuevo,
  los de importe fijo se apuntan solos (día 1) y los variables aparecen como
  "pendientes" en la vista que toque (Yo, Repartidos o Conjunta) con el importe
  anterior sugerido. Frecuencia cada 1/2/3/6/12 meses. Se pueden pausar.
- **Huchas simples**: meter y sacar, objetivo y fecha opcionales, "te tocan X €/mes" y
  "a tu ritmo llegas en…" (media de los últimos 3 meses), quién ha puesto qué en las
  comunes. La pestaña Juntos pasa a ser **Huchas**; lo que la pareja hace público
  queda plegado al final de Repartidos.
- **Cuenta conjunta** sustituye a "bote" en toda la interfaz. **Mi mes** = personal +
  repartido + mi porcentaje de la conjunta (también el donut, el límite y las barras).
- **Selector de mes** único en la barra superior (toca el nombre del mes para volver
  a hoy).
- **Identidad**: logo B (hucha) como icono de la app, favicon y marca; manifest para
  instalar en el móvil (`public/`, `scripts/make-icons.mjs`). Iconos de trazo en toda
  la interfaz (`lib/uiIcons.ts`, `components/UiIcon.vue`); sin emojis salvo los que
  elige el usuario. Google oculto hasta configurarlo (`GOOGLE_LOGIN` en LoginView).

**2026-09-16 · v0.3 — fase 3: gráficas y límite mensual.**

- Migración `0005_presupuestos.sql`: tabla `budgets` y función `set_budget()`.
- Entra Chart.js (`src/lib/charts.ts`, `composables/useChart.ts`). Tres componentes:
  `DonutChart` (por categoría, total en el centro), `MonthlyBars` (últimos 6 meses,
  apiladas por persona o con línea de media) y `BudgetChart` (acumulado día a día,
  límite en rojo discontinuo, diagonal de ritmo, tramo y área rojos al pasarse).
- `BudgetCard`: "llevas X de Y", estado por ritmo (vas bien / ojo / superado),
  "te quedan X € para Y días · Z €/día", y el gráfico. Permite poner, cambiar y
  quitar el límite desde la propia tarjeta.
- Yo: donut con leyenda, límite personal, barras de 6 meses. Pareja → Repartidos:
  barras apiladas de quién ha pagado; Pareja → Bote: donut, límite del bote y barras.
- Ajustes: sección "Límites mensuales" (personal y bote).

**2026-09-15 · iconos y paleta del lienzo de diseño.**
Las categorías ya no se muestran con emoji sino con el juego de 10 iconos "estilo
GasTitos" del lienzo *Logo GasTitos* (trazo de 2 px), cada uno con su color de la
paleta: Casa azul, Comida teja, Transporte verde azulado, Ocio malva, Salud verde,
Ropa mostaza, Regalos rosa, Viajes azul, Suscripciones lila, Otros gris. Migración
`0004_iconos_categorias.sql`: columna `icon` en `categories`, las categorías de serie
reciben su icono y color. En Ajustes → Categorías se puede elegir un icono GasTitos
(aplica su color) o seguir con un emoji. Las pantallas vacías (sin gastos, sin
huchas, invita a tu pareja) usan las tres ilustraciones del lienzo en vez de emojis
grandes (`components/EmptyState.vue`). Las huchas siguen con emoji.

**2026-09-15 · menú de tres puntos en los gastos + scroll en móvil.**
Las listas de gastos ya no muestran los botones de emoji (✏️ 🗑️ 🔒). En su lugar hay
un botón de tres puntos (dibujado en SVG) que despliega un menú pequeño justo debajo
(o encima, si no cabe) con las mismas opciones escritas: editar, hacer público/privado
(solo en la vista Yo) y borrar. Se cierra al tocar fuera o con Escape. El emoji de la
categoría sigue a la izquierda de cada gasto.
Además, mientras una hoja modal está abierta la página de detrás queda fija
(`src/lib/scrollLock.ts`, con test): en iOS el scroll "se escapaba" y la página se
quedaba a medias. El hueco inferior del contenido cuenta ahora la zona segura del iPhone,
para que el último elemento no quede bajo la barra de navegación.

**2026-09-15 · v0.2 — fase 1: reparto real + rediseño.**

- Migración `0002_reparto.sql`: categorías por hogar con emoji y color, porcentaje de
  reparto por miembro, gastos del bote, partes por gasto (`expense_shares`),
  liquidaciones (`settlements`), función `save_expense()`.
- Tres tipos de gasto: personal, repartido (5 modos de reparto) y del bote.
- Pareja → pestañas Repartidos (balance con signo, Saldar, historial de pagos),
  Bote (gastos de la cuenta conjunta por categoría) y Juntos (huchas comunes + lo que
  la pareja hace público).
- Yo → "Mi mes" = personal + mi parte de los repartidos, por categoría; huchas.
- Ajustes: nombre, hogar, reparto por defecto (slider), editor de categorías (emoji,
  color, orden), código de invitación.
- Diseño nuevo: Sora + Manrope, tarjetas, navegación inferior con botón ➕ y menú
  rápido, hojas modales, modo oscuro automático, color por espacio (verde Yo, ciruela
  Pareja).

**2026-09-15 · v0.1 — esqueleto inicial.**
Hecho en la primera sesión:

- Migración `0001_init.sql` con tablas, funciones y RLS.
- App Vue completa: login (email + Google), alta en hogar (crear / unirse con
  código), vista Pareja, vista Yo, formularios de gasto y objetivo, aportaciones,
  candado público/privado.
- Workflows: deploy a GitHub Pages, migraciones automáticas, keepalive.
- Tests de las utilidades de dinero.

Configuración manual completada salvo Google login y la prueba con la segunda cuenta
(ver `CONFIGURACION-MANUAL.md`). La app funciona de extremo a extremo: el primer hogar
se creó el 2026-09-15.

## Decisiones tomadas

| Decisión | Por qué |
|---|---|
| Un "hogar" con máximo 2 miembros | La app es para una pareja. El límite lo impone un trigger en la base de datos. |
| Unión por código de invitación | Evita que un desconocido que entre con Google vea nada: sin hogar no hay datos. |
| Privacidad en RLS, no en la interfaz | Aunque alguien manipule la web, Supabase no devuelve filas que no le tocan. |
| Balance 50/50 | Es lo más simple. Si un día queréis repartir por porcentaje, es un campo más en `households`. |
| Router en modo hash | GitHub Pages no sabe de rutas; con `#/pareja` no hace falta configurar nada. |
| Sin registro abierto | Las dos cuentas se crean a mano en Supabase y se desactiva el signup. |
| Gastos compartidos editables por los dos | Cualquiera de la pareja puede corregir un gasto común. Lo personal solo su dueño. |

## Pendiente / ideas

El plan completo por fases está en `PLAN.md`. Lo de abajo son ideas sueltas anteriores.

- Reparto distinto de 50/50.
- Gastos recurrentes (alquiler, suscripciones).
- Exportar a CSV.
- Avisos cuando un objetivo se cumple o vence.
- Modo oscuro.

## Cómo trabajar

Ver `CLAUDE.md` en la raíz. En resumen: pide un cambio cada vez, ejecuta
`npm test` y `npm run build` antes de subir, y los cambios de base de datos van
en un archivo nuevo de `supabase/migrations/`.
