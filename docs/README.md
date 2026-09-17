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

**2026-09-17 · v0.5.2 — confirmaciones propias, guardado seguro y modo sin conexión.**

- Ventana de confirmación propia (`composables/useConfirm.ts`, `components/ConfirmDialog.vue`)
  en lugar del `confirm()` del navegador. Uso: `if (await confirm({ message }))`.
- El formulario de gasto se queda abierto hasta que el servidor confirma (`editor.state.saving`,
  botón "Guardando…"); si falla, aparece el error y no se pierde lo escrito.
- Sin conexión: `public/sw.js` guarda la app (página, assets, fuentes) para que abra; los datos
  se guardan como copia local por usuario en localStorage (`lib/offline.ts`) y se enseñan con
  una franja amarilla de aviso. Al volver la red se recarga sola. Límites: no se puede guardar
  sin conexión, y si la sesión caducó (más de una hora cerrada y sin red) pide entrar.
  La copia local se borra al cerrar sesión.

**2026-09-17 · v0.5.1 — revisión: arreglos tras repasar el código.**

- Supabase devuelve como mucho 1000 filas por consulta: con los años faltarían gastos
  antiguos y el balance saldría mal. Ahora se cargan por páginas (`fetchAll` en `useData`).
- Al cerrar sesión y entrar con la otra cuenta en el mismo móvil se veían los datos del
  usuario anterior hasta recargar: los datos se vacían al cerrar sesión o cambiar de usuario.
- Reactivar un gasto fijo pausado creaba de golpe los gastos de los meses en pausa.
  Migración `0007_fijos_pausados.sql`: columna `active_since` (la pone un trigger) y
  `run_recurring` salta los meses anteriores.
- Al volver a la app (desbloquear el móvil) se recargan los datos si tienen más de un
  minuto: aparecen los gastos de la pareja y los fijos de un mes nuevo sin recargar la web.
- El límite decía "Mes cerrado" el último día del mes. Mensajes claros al repetir el
  nombre de una categoría o borrar una con gastos fijos. Los pendientes sin importe
  anterior empiezan vacíos en vez de con 0.

**2026-09-17 · v0.5 — el cerdito.**

- Botón discreto con la cara del cerdito en la barra superior, junto a Ajustes. Abre una
  conversación con tres preguntas preparadas: "¿Cómo voy este mes?", "¿En qué gasto más?" y
  "¿Dónde puedo ahorrar?". **No es una IA**: son reglas sobre "lo mío" (personal + mi parte
  de repartidos + mi % de la conjunta) en `lib/insights.ts`, con tests. Compara con el mes
  pasado *a estas alturas* (mismo día), avisa del límite, propone recortar el mayor gasto
  variable, cuánto pesan los fijos y cuánto meter en cada hucha con fecha.
- Puntito rojo en el botón solo si hay algo importante (límite superado o por encima del ritmo,
  subidas grandes) que no se ha visto; se recuerda en el navegador (`composables/useInsights.ts`).
- Idea futura: chat con IA de verdad mediante una Edge Function de Supabase que guarde la
  clave y reciba solo estos resúmenes.

**2026-09-17 · v0.4.2 — mejoras tras las pruebas: fijos personales, más iconos y tacto.**

- **Gastos fijos personales en la vista Yo**: tarjeta "Mis gastos fijos" con botón
  "+ Fijo" (gimnasio, móvil, suscripciones…). Se apuntan solos cada mes como gasto
  personal privado. Lista reutilizable `components/RecurringList.vue` (también en Ajustes);
  `RecurringForm` admite `fixed-kind` para ocultar el selector de tipo.
- **56 iconos de categoría** (antes 10) en 7 grupos, con nombre bajo cada icono y caja con
  scroll en el selector. Al elegir un icono con el nombre vacío, se rellena solo. Las 10
  claves de serie no cambian.
- **Tacto en móvil**: campos a 16 px (el iPhone ya no amplía la página al tocarlos), sin
  zoom por doble toque, hover solo con ratón (no se queda "pegado"), respuesta visual al
  pulsar, botones y chips más grandes. El aviso flotante ya no tapa los botones de debajo.
  Las hojas solo se cierran si el toque empieza y acaba en el fondo. El menú de las huchas
  se cierra al tocar fuera. Los pendientes no se pueden enviar dos veces.

**2026-09-16 · v0.4.1 — recuperar contraseña, exportar CSV, medias sin meses vacíos.**

- "¿Has olvidado la contraseña?" en la entrada: Supabase envía un enlace que vuelve a la
  app y abre la pantalla "Nueva contraseña" (`views/NewPasswordView.vue`; el evento
  `PASSWORD_RECOVERY` pone `state.recovery` en `useSession`). El enlace hay que abrirlo
  en el mismo dispositivo desde el que se pidió.
- Ajustes → Tus datos: dos botones que descargan CSV (separador `;`, coma decimal, BOM
  para Excel): gastos + pagos entre vosotros, y huchas + movimientos (`lib/csv.ts`).
- La línea de media de las barras de 6 meses solo promedia los meses con datos. La
  proyección de una hucha solo cuenta los meses desde que existe.

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

El plan completo por fases está en `PLAN.md`.

### TAREA PENDIENTE · Pagos detectados con Apple Pay (apuntada 2026-09-17)

**Idea:** que los pagos hechos con el móvil lleguen solos a GasTitos y, al abrir la app,
aparezcan en una tarjeta "Pagos detectados" para apuntarlos de un toque
(Personal / Conjunta / Repartido) o descartarlos.

**Contexto:** los dos tenéis iPhone. Cuentas personales en Bankinter (cada uno la suya) y
cuenta conjunta en Revolut.

**Decisión:** no usar SMS. Una web no puede leerlos y Revolut solo avisa con notificaciones
de su app, que el iPhone no deja leer. En su lugar, la automatización **"Transacción"** de
la app Atajos (iOS 17+), que salta al pagar con una tarjeta de la Cartera y da importe,
comercio y nombre de la tarjeta.

**Paso 0 (lo hace el dueño, antes de programar nada):** comprobar que el aviso salta con
las dos tarjetas.
1. Atajos → Automatización → + → **Transacción**.
2. Marcar las tarjetas de Bankinter y Revolut → **Ejecutar inmediatamente** → Siguiente.
3. Nuevo atajo en blanco → acción **Mostrar notificación** con la variable **Entrada del atajo**.
4. Pagar algo pequeño con Apple Pay con cada tarjeta y anotar qué texto sale (tapando
   números de tarjeta).
Si solo funciona con una tarjeta, buscar otra vía para la otra (p. ej. SMS de alertas de
Bankinter).

**Plan técnico (cuando el paso 0 funcione):**
- Migración nueva: tabla `detected_payments` (usuario, importe, comercio, tarjeta, fecha,
  estado pendiente/apuntado/descartado, `expense_id`) con RLS: cada uno solo ve los suyos.
  Tabla o columna para un **código secreto por usuario** que usa el atajo.
- Edge Function de Supabase que recibe el POST del atajo, valida el código y guarda el pago.
- Tipo propuesto según la tarjeta: Bankinter → Personal, Revolut → Conjunta (configurable
  en Ajustes). Categoría sugerida recordando la última elegida para ese comercio.
- Tarjeta "Pagos detectados" arriba en Yo: botones Personal / Conjunta apuntan directo con
  `save_expense`; Repartido abre el formulario relleno; ✕ descarta.
- Guía paso a paso para crear el atajo definitivo en cada iPhone (acción "Obtener contenido
  de URL" con el importe, comercio, tarjeta y el código).
- Límite conocido: no pilla pagos con tarjeta física, compras online sin Apple Pay ni
  recibos (esos ya van por gastos fijos).

### Ideas sueltas anteriores

- Vista anual, buscar/filtrar gastos, mover gastos de una categoría a otra en bloque,
  exportar CSV con el menú de compartir del iPhone, ingresos, avisos en el móvil, deshacer.
- Avisos cuando un objetivo se cumple o vence.
- Chat con IA de verdad para el cerdito (Edge Function con la clave; solo resúmenes).
- Modo oscuro.

## Cómo trabajar

Ver `CLAUDE.md` en la raíz. En resumen: pide un cambio cada vez, ejecuta
`npm test` y `npm run build` antes de subir, y los cambios de base de datos van
en un archivo nuevo de `supabase/migrations/`.
