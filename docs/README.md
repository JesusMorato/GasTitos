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

**2026-09-21 · v0.8 — avisos en el móvil cuando la pareja apunta un gasto que te toca. ✅ funcionando en los dos iPhone.**

- **Qué avisa**: solo los gastos **nuevos** repartidos o de la **cuenta conjunta**. Los
  personales no (son privados) y los fijos automáticos tampoco (ya se esperan).
- **Camino**: `useData.guardarGasto` llama a `notifyPartner` tras `save_expense` → función
  `notify-partner` (Supabase Edge Function) → aparatos de la pareja
  (`push_subscriptions`) → `push` en `public/sw.js`, que enseña el aviso. Al tocarlo se
  abre `#/pareja`. Si el aviso falla, el gasto queda guardado igual.
- **Web Push a mano, sin librerías**: cifrado RFC 8291 (aes128gcm) y firma VAPID RFC 8292
  con WebCrypto en `supabase/functions/notify-partner/webpush.ts`. Probado de ida y vuelta
  en `webpush.spec.ts` (se cifra como el servidor y se descifra como el navegador).
- **Ajustes → "Avisos en el móvil"**: interruptor por aparato, explicación de por qué no
  se puede cuando toca (falta clave, iPhone sin instalar, permiso bloqueado) y botón para
  ver cómo se ve un aviso. Reglas puras y testeadas en `lib/push.ts`.
- **Nuevo automatismo** `.github/workflows/funciones.yml`: publica `supabase/functions/**`
  con la CLI de Supabase (necesita el secret `SUPABASE_ACCESS_TOKEN`; sin él avisa y sale
  en verde). El identificador del proyecto se saca de la URL que ya está en `.env`.
- Migración `0011_avisos_push.sql`. Service worker a `gastitos-v2`.
- **Configurado y probado el 2026-09-21.** Secretos en Supabase: `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` (este último tiene que ser un `mailto:`, o Apple
  rechaza los envíos con un 403). En GitHub: `SUPABASE_ACCESS_TOKEN`.
- **Tres cosas aprendidas al ponerlo en marcha**, ya resueltas en el código:
  1. Los secretos se leen **en cada petición**, no al arrancar la función: crearlos ya no
     obliga a volver a publicarla.
  2. Un permiso del navegador queda atado a la clave pública con la que se pidió. Si se
     cambian las claves, hay que renovarlo: `mismaClave` (`lib/push.ts`) lo detecta y
     `usePush.activar` tira el permiso viejo y pide otro.
  3. El diagnóstico de Ajustes ("Probar el envío de verdad") manda un aviso a uno mismo y
     enseña el código del servicio, el remitente usado y **los nombres de los secretos que
     ve la función**. Sin eso no había forma de depurar sin entrar en Supabase.

**2026-09-20 · v0.7.1 — mejoras pequeñas: deshacer, editar movimientos, compartir CSV, avisos de hucha y pagos de la pareja.**

- **Deshacer**: al borrar un gasto, un movimiento de hucha o descartar un pago detectado,
  el aviso de abajo lleva un botón "Deshacer" (7 s). `useEditor.toast(msg, { label, run })`;
  el gasto se vuelve a crear con `reinsertExpense` (id nuevo, mismas partes).
- **Editar un movimiento de hucha** (lápiz junto a la papelera, solo los propios): el
  formulario de meter/sacar se rellena y el botón pasa a "Guardar". `updateContribution`.
- **Exportar CSV**: en el móvil abre el menú de compartir (`shareOrDownload` en `lib/csv.ts`,
  Web Share API con archivo); si no existe, descarga como antes.
- **Cerdito**: "hucha conseguida" ahora es importante (sale el puntito) y hay aviso nuevo
  de **hucha vencida** (fecha pasada sin llegar). Regla y test en `lib/insights.ts`.
- **Pagos detectados**: en Ajustes, lista "Descartados hace poco" con botón Recuperar;
  en Pareja, "X tiene N pagos detectados sin apuntar" (solo el número, función
  `partner_pending_payments`); limpieza automática al registrar un pago (descartados de
  más de 90 días y apuntados de más de un año). Migración `0010_pagos_pareja_y_limpieza.sql`.

**2026-09-18 · v0.7 — pagos detectados desde el iPhone (Apple Pay → Atajos → GasTitos).**

- **Cómo funciona**: la automatización "Transacción" de Atajos salta al pagar con Apple Pay
  y manda importe, comercio y tarjeta a la función pública `register_payment` (con la clave
  anon; el usuario se identifica por su **código secreto**). El pago queda en
  `detected_payments` y sale en **Yo** en la tarjeta "Pagos detectados"
  (`components/DetectedPayments.vue`). Guía para montarlo: `docs/PAGOS-DETECTADOS.md`.
- **Bolita**: contador rojo en la pestaña "Yo" de la barra inferior y en el icono de la app
  instalada (`navigator.setAppBadge`, iOS 16.4+ con la app en pantalla de inicio).
- **Apuntar de un toque**: Personal / Conjunta con categoría recordada (último gasto apuntado
  del mismo comercio, `lib/payments.ts`) se guardan directos con `save_expense`; si no hay
  categoría o es Repartido, se abre el editor global ya relleno (`useEditor.openNew` con
  `prefill` y `fromPayment`; al guardar se marca el pago como apuntado). ✕ lo descarta.
- **Ajustes → "Pagos automáticos (iPhone)"**: crear/renovar el código, copiar dirección y
  clave, "Enviar un pago de prueba" (mismo camino que el atajo) y tipo propuesto por tarjeta
  (`payment_settings.card_kinds`; sin ajuste, Revolut → Conjunta y el resto → Personal).
- Migración `0009_pagos_detectados.sql`; `saveExpense` devuelve ahora el id del gasto.
- **Funciona en producción (confirmado 2026-09-20 con un pago físico).** Dentro de la
  automatización la variable del pago se llama **"Transacción"** (propiedades Importe,
  Comerciante, Tarjeta o pase). Una compra **online** con Apple Pay NO dispara la
  automatización: solo pagos acercando el móvil.
- **Memoria por comercio** (`remembered` en `lib/payments.ts`): el último gasto apuntado
  desde un pago del mismo comercio fija el tipo propuesto (manda sobre la tarjeta) y la
  categoría. Con memoria, Personal y Conjunta se apuntan directos; Repartido también si
  aquella vez fue con el reparto del hogar (partes calculadas con `computeShares`).
- Decidido: sin notificaciones push (saldrían en cada pago) y sin enlazar pagos con gastos
  fijos (las suscripciones no pasan por Apple Pay).
- Al volver a la app se consultan siempre los pagos detectados (`refreshPayments`), aunque
  el resto de datos sea reciente. El pago de prueba lleva importe aleatorio para que no lo
  descarte el filtro de repetidos (mismo importe y comercio en 2 minutos).
- Ajustes → Gastos fijos: la lista va en bloques (Cuenta conjunta / Repartidos / Personales),
  prop `grouped` de `RecurringList`.

**2026-09-18 · v0.6.1 — categorías por arrastre y gastos fijos solo en Ajustes.**

- **Ordenar categorías arrastrando**: en Ajustes → Categorías cada fila tiene un asa
  (seis puntitos) a la izquierda; se arrastra con el ratón o el dedo y al soltar se
  guarda el orden de golpe (`reorderCategories` en `useData.ts`). Desaparecen las
  flechas subir/bajar. Lógica pura en `lib/reorder.ts` (testeada). El asa está en la
  lista de zonas que ignora el deslizar entre vistas (`lib/swipe.ts`).
- **La tarjeta "Mis gastos fijos" ya no está en la vista Yo**: los fijos personales se
  crean y editan en Ajustes → Gastos fijos (allí aparecen todos, con su tipo). En Yo
  sigue el aviso de pendientes por rellenar y la etiqueta "N fijos" en "Mis gastos".

**2026-09-17 · desglose desplegable en el donut.**
En el donut de "Mi mes" (Yo) y de la cuenta conjunta (Pareja), al pulsar una categoría
de la leyenda o su trozo del donut se despliega con animación la lista de gastos que
la componen (fecha, concepto, importe; en los repartidos "tu parte de X", en la
conjunta "tu % de X") y termina con la suma. El trozo elegido se separa del donut.
Componente `CategoryBreakdown.vue` (la leyenda), agrupación en `lib/breakdown.ts`
(puro, con tests); `myItems` (`lib/insights.ts`) lleva ahora id, concepto y origen
de cada importe.

**2026-09-17 · v0.6 — resumen del año, buscador y mover categorías en bloque.**

- **Resumen del año** (`views/YearView.vue`, enlace "Ver el resumen del año" bajo las barras de 6 meses en Yo y Pareja, con botón Volver):
  pestañas Yo / Pareja, total y media mensual, mes más alto, barras de los 12 meses
  (en Pareja, repartido + conjunta apiladas y quién pagó), donut y lista por categoría con
  % y media al mes, y lo metido en huchas ese año.
- **Buscar gastos** (`views/SearchView.vue`, lupa junto a "+ Añadir" encima de cada lista de gastos; llega con el tipo ya marcado): texto sin tildes en
  nota y categoría, tipo, categorías e importe mínimo/máximo, en todos los meses. Resultados
  agrupados por mes con total; editables (los públicos de la pareja, solo lectura).
  Filtro puro en `lib/search.ts` con tests.
- **Mover gastos de categoría en bloque**: migración `0008_mover_categoria.sql` con
  `move_category(desde, hasta, borrar)` (security definer: mueve también los privados de la
  pareja). En Ajustes → editar categoría: "Mover todos" o "Mover y borrar categoría". Borrar una
  categoría con gastos abre esa hoja.

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

El plan completo por fases está en `PLAN.md`. Revisado el 2026-09-20: todo lo pedido está
hecho y publicado. Lo que sigue son evolutivos abiertos, ninguno comprometido.

### Requieren una decisión del dueño

- **Ingresos y tasa de ahorro** (fase 7 del plan): registrar ingresos privados para
  calcular "podrías ahorrar X". Es la única fase del plan sin hacer y sigue sin decidirse.
- **Login con Google**: el código está listo y oculto (`GOOGLE_LOGIN = false` en
  `LoginView.vue`); solo falta la configuración manual del punto 5 de
  `CONFIGURACION-MANUAL.md`. Opcional.

### Mejoras pequeñas, a demanda

Las cinco de la revisión del 2026-09-20 están hechas (v0.7.1). No queda ninguna apuntada.

### Descartado

- Notificaciones push (saldrían en cada pago). Enlazar pagos detectados con gastos fijos
  (las suscripciones no pasan por Apple Pay). Open Banking (coste y complejidad).
- Chat con IA para el cerdito: se queda con reglas.
- Retos de ahorro y redondeo (decisión del 2026-09-16).

## Cómo trabajar

Ver `CLAUDE.md` en la raíz. En resumen: pide un cambio cada vez, ejecuta
`npm test` y `npm run build` antes de subir, y los cambios de base de datos van
en un archivo nuevo de `supabase/migrations/`.
