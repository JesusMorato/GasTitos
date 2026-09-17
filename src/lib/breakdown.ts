// Desglose por categoría con los gastos que lo componen.
// Puro y testeado: agrupa por clave, suma con redondeo a céntimos y ordena.
import { round2 } from './money'

export interface BreakdownItem {
  id: string
  label: string
  /** Fecha ISO (AAAA-MM-DD). */
  date: string
  amount: number
  /** Aclaración opcional, p. ej. "tu parte de 80,00 €". */
  note?: string
}

export interface BreakdownRow {
  key: string
  total: number
  items: BreakdownItem[]
}

/** Agrupa los gastos por `key`. Filas de mayor a menor total; dentro, del más reciente al más antiguo. `limit` recorta las filas. */
export function breakdownBy(items: Array<BreakdownItem & { key: string }>, limit?: number): BreakdownRow[] {
  const map = new Map<string, BreakdownRow>()
  for (const it of items) {
    const row = map.get(it.key) ?? { key: it.key, total: 0, items: [] }
    const { key: _k, ...rest } = it
    row.items.push(rest)
    row.total = round2(row.total + Number(it.amount))
    map.set(it.key, row)
  }
  return [...map.values()]
    .map((r) => ({ ...r, items: [...r.items].sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit ?? Infinity)
}
