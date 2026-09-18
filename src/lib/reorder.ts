// Reordenar una lista arrastrando: lógica pura, sin DOM.

/** Devuelve una copia de `list` con el elemento de la posición `from` colocado en `to`. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const out = [...list]
  if (from < 0 || from >= out.length || to < 0 || to >= out.length || from === to) return out
  const [item] = out.splice(from, 1)
  out.splice(to, 0, item)
  return out
}

/**
 * Dado el nuevo orden de elementos, calcula qué `sort_order` hay que guardar.
 * Solo devuelve los que cambian (así una lista sin tocar no genera escrituras).
 * Los valores van de 10 en 10 para que quepan nuevos elementos al final.
 */
export function sortOrderUpdates<T extends { id: string; sort_order: number }>(ordered: T[]): { id: string; sort_order: number }[] {
  const updates: { id: string; sort_order: number }[] = []
  ordered.forEach((item, i) => {
    const sort_order = (i + 1) * 10
    if (item.sort_order !== sort_order) updates.push({ id: item.id, sort_order })
  })
  return updates
}

/**
 * A partir de la posición vertical del puntero y los límites (top/bottom) de cada
 * fila, dice en qué índice debería caer el elemento arrastrado.
 */
export function indexAtY(rows: { top: number; bottom: number }[], y: number): number {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (y < (r.top + r.bottom) / 2) return i
  }
  return Math.max(0, rows.length - 1)
}
