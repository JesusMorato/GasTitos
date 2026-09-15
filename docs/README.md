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

**2026-09-15 · menú de tres puntos en los gastos.**
Las listas de gastos ya no muestran los botones de emoji (✏️ 🗑️ 🔒). En su lugar hay
un botón de tres puntos (dibujado en SVG) que abre una hoja con las mismas opciones escritas: editar,
hacer público/privado (solo en la vista Yo) y borrar. El emoji de la categoría sigue
a la izquierda de cada gasto.

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
