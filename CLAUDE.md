# GasTitos · guía para Claude Code

App web de gastos y ahorro para una pareja (exactamente dos usuarios). Vista "Pareja"
(gastos compartidos, balance 50/50, objetivos comunes, lo que la otra persona hace
público) y vista "Yo" (gastos y objetivos personales, privados por defecto, con botón
público/privado por elemento).

El dueño del proyecto es principiante: explica los cambios en lenguaje sencillo y sin
jerga innecesaria. Una cosa cada vez.

Cuando pida un cambio, desarróllalo directamente: nada de mockups, capturas ni vistas
previas salvo que las pida expresamente. Al terminar, fusiona en `main` y haz push (eso
publica la web) salvo que diga lo contrario.

## Stack

- Frontend: Vue 3 + TypeScript + Vite. Router en modo hash. Sin Pinia (estado en
  composables `src/composables/`).
- Backend: Supabase (Postgres + Auth). Cliente en `src/supabase.ts`.
- Tests: Vitest (`npm test`). Los tests viven junto al código (`*.spec.ts`).
- Publicación: GitHub Pages desde la rama `gh-pages`, base `/GasTitos/`.
- Automatismos: `.github/workflows/` (deploy, migraciones, keepalive).

## Comandos

```
npm install        # primera vez
npm run dev        # servidor local
npm test           # tests
npm run build      # typecheck + build (lo mismo que hace el deploy)
```

En el portátil del trabajo (proxy corporativo) npm falla con `SELF_SIGNED_CERT_IN_CHAIN`.
Ejecuta los comandos con `NODE_USE_SYSTEM_CA=1` delante (o `$env:NODE_USE_SYSTEM_CA=1`
en PowerShell) para que Node confíe en los certificados de Windows. En GitHub Actions
no hace falta.

Antes de hacer push ejecuta `npm test` y `npm run build`: si falla aquí, fallará en
GitHub Actions.

## Convenciones

- Idioma de la interfaz, comentarios y commits: español.
- Nunca subir secretos. `.env` solo contiene la URL y la clave *pública* de Supabase.
  La contraseña de la base de datos vive únicamente en el secret `SUPABASE_DB_URL`
  de GitHub.
- Cambios de base de datos = nuevo archivo `supabase/migrations/NNNN_descripcion.sql`
  (numeración consecutiva, nunca editar uno ya aplicado). Deben ser idempotentes
  (`if not exists`, `drop policy if exists` …) y terminar con el `insert` en
  `schema_migrations` con su propio nombre.
- Toda tabla nueva lleva RLS activado y políticas explícitas. La privacidad se
  garantiza en la base de datos, no solo en la interfaz.
- Importes: `numeric(12,2)` en Postgres; en el cliente se convierten a número en
  `useData.ts`. Cálculos de dinero en `src/lib/money.ts` (puro, testeado).
- Los componentes reciben datos por props y emiten eventos; las llamadas a Supabase
  se concentran en `src/composables/useData.ts` y `useSession.ts`.
- Los gastos se crean y editan SIEMPRE con la función `save_expense` (RPC), nunca con
  insert/update directos: es la que mantiene coherentes las partes del reparto.
- Diseño: tokens en `src/style.css`. Cada vista envuelve su contenido en `.space-yo`
  (verde) o `.space-pareja` (ciruela), que fijan `--accent`. Modales con
  `components/Sheet.vue`. Emojis y colores los elige el usuario con `EmojiPicker.vue`.
- El editor de gastos es global (`useEditor.ts`): el botón ➕ de `App.vue` y las vistas
  comparten el mismo formulario.

## Modelo de datos (resumen)

Ver `docs/MODELO-DATOS.md`. Claves: `households` (1 pareja), `household_members`
(máx. 2, uno por usuario), `expenses`, `savings_goals`, `goal_contributions`.
Flags: `is_shared` (de la pareja) e `is_public` (individual pero visible para la
pareja, solo lectura).

## Documentación

- `docs/README.md` — estado del proyecto y decisiones tomadas.
- `docs/MODELO-DATOS.md` — tablas y reglas de visibilidad.
- `docs/PLAN.md` — plan de producto v2: estado del arte, modelo, fases y decisiones.
- `docs/CONFIGURACION-MANUAL.md` — pasos que solo puede hacer el dueño (secrets,
  Pages, usuarios, Google).

Al terminar una sesión con cambios relevantes, actualiza `docs/README.md`
(sección "Estado" y "Pendiente").

## Gráficas

Chart.js registrado en `src/lib/charts.ts` (solo los módulos que usamos) y montado con
`composables/useChart.ts`, que reconstruye la gráfica al cambiar datos o tema. Los
colores se leen de las variables CSS del propio `<canvas>` (`chartTheme(el)`), así las
gráficas respetan `.space-yo` / `.space-pareja` y el modo oscuro. Chart.js necesita
colores en hex, no `var()`: convierte con `withAlpha` o lee la variable resuelta.
Componentes: `DonutChart`, `MonthlyBars`, `BudgetChart` (dentro de `BudgetCard`).

## Iconos e ilustraciones (regla de estilo, 2026-09-16)

- **Nada de emojis en la interfaz de la app**: ni en botones (ajustes, añadir, menú),
  ni en los tipos de gasto del menú ➕, ni en listas (pagos, huchas por defecto), ni en
  la pantalla de entrada. Se dibujan como SVG de trazo 2 px, esquinas redondas, rejilla
  24, igual que el juego de iconos de categoría de `src/lib/icons.ts`.
- Las **ilustraciones grandes** (pantallas vacías, entrada) siguen el estilo plano sin
  trazo de `components/EmptyState.vue`: la hucha, la planta, las dos personas.
- Los emojis solo aparecen donde **el usuario los elige**: categorías (si prefiere emoji
  al icono propio) y huchas. El selector de emoji se mantiene para eso.
- La palabra "bote" no se usa en la interfaz: es **"cuenta conjunta"** (pestaña
  "Conjunta"). En el código sigue siendo `pot`.
