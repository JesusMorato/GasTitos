// Registro de Chart.js (solo lo que usamos) y utilidades de color/tema.
import {
  ArcElement, BarController, BarElement, CategoryScale, Chart, DoughnutController, Filler,
  LineController, LineElement, LinearScale, PointElement, Tooltip,
} from 'chart.js'

Chart.register(
  ArcElement, BarController, BarElement, CategoryScale, DoughnutController, Filler,
  LineController, LineElement, LinearScale, PointElement, Tooltip,
)

export { Chart }

/** Lee una variable CSS resuelta en un elemento (p. ej. --accent dentro de .space-yo). */
export function cssVar(el: Element, name: string, fallback = '#888888'): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim()
  return v || fallback
}

/** '#rrggbb' → 'rgba(r,g,b,a)'. Si no es hex, devuelve el color tal cual. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

/** Colores del tema que necesitan las gráficas, leídos del elemento canvas. */
export function chartTheme(el: Element) {
  return {
    accent: cssVar(el, '--accent', '#2f6f5e'),
    ink: cssVar(el, '--ink', '#17211d'),
    ink2: cssVar(el, '--ink-2', '#62716a'),
    ink3: cssVar(el, '--ink-3', '#97a49d'),
    line: cssVar(el, '--line', '#e1e7e2'),
    surface: cssVar(el, '--surface', '#ffffff'),
    neg: cssVar(el, '--neg', '#c8553d'),
    warn: cssVar(el, '--warn', '#b8862b'),
    font: "'Manrope', system-ui, sans-serif",
  }
}

export function eurTick(v: number | string): string {
  const n = Number(v)
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k €`
  return `${Math.round(n)} €`
}
