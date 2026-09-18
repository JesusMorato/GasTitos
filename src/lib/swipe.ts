// Deslizar horizontalmente para cambiar de vista. Ignora los gestos que empiezan
// sobre una gráfica, un control deslizante, una hoja abierta o las pestañas.
const IGNORE = '.chart-box, input[type="range"], .sheet-backdrop, .segmented, .menu, textarea, .drag-handle'
const MIN_X = 64
const MAX_Y = 48

export function installSwipe(onSwipe: (dir: 'left' | 'right') => void): () => void {
  let x0 = 0
  let y0 = 0
  let tracking = false

  const start = (e: TouchEvent) => {
    const t = e.touches[0]
    const target = e.target as HTMLElement | null
    tracking = !!t && !target?.closest(IGNORE)
    if (!t) return
    x0 = t.clientX
    y0 = t.clientY
  }
  const end = (e: TouchEvent) => {
    if (!tracking) return
    tracking = false
    const t = e.changedTouches[0]
    if (!t) return
    const dx = t.clientX - x0
    const dy = t.clientY - y0
    if (Math.abs(dx) >= MIN_X && Math.abs(dy) <= MAX_Y) onSwipe(dx < 0 ? 'left' : 'right')
  }
  document.addEventListener('touchstart', start, { passive: true })
  document.addEventListener('touchend', end, { passive: true })
  return () => {
    document.removeEventListener('touchstart', start)
    document.removeEventListener('touchend', end)
  }
}
