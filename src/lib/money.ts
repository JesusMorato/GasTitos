// Utilidades de dinero puras (sin Vue ni Supabase) para poder testearlas fácil.

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + Number(v), 0))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export interface Balance {
  /** Total gastado en compartido por cada miembro (user_id → importe). */
  paidBy: Record<string, number>
  /** Total de gastos compartidos. */
  total: number
  /** Quién debe a quién para quedar en paz, o null si están a la par. */
  settlement: { from: string; to: string; amount: number } | null
}

/**
 * Balance de gastos compartidos entre dos miembros, a medias (50/50).
 * Solo se tienen en cuenta los gastos con is_shared = true.
 */
export function computeBalance(
  expenses: Array<{ user_id: string; amount: number; is_shared: boolean }>,
  memberIds: string[],
): Balance {
  const paidBy: Record<string, number> = {}
  for (const id of memberIds) paidBy[id] = 0

  const shared = expenses.filter((e) => e.is_shared)
  for (const e of shared) {
    paidBy[e.user_id] = round2((paidBy[e.user_id] ?? 0) + Number(e.amount))
  }
  const total = sum(shared.map((e) => e.amount))

  if (memberIds.length !== 2) {
    return { paidBy, total, settlement: null }
  }

  const [a, b] = memberIds
  const diff = round2((paidBy[a] - paidBy[b]) / 2)
  if (Math.abs(diff) < 0.005) return { paidBy, total, settlement: null }

  // Quien ha pagado menos le debe la mitad de la diferencia al otro.
  return diff > 0
    ? { paidBy, total, settlement: { from: b, to: a, amount: diff } }
    : { paidBy, total, settlement: { from: a, to: b, amount: -diff } }
}

/** Progreso de un objetivo, entre 0 y 1 (puede superar 1 si se pasa). */
export function goalProgress(saved: number, target: number): number {
  if (target <= 0) return 0
  return round2(saved / target)
}

/** Agrupa importes por categoría, ordenado de mayor a menor. */
export function totalsByCategory(
  expenses: Array<{ category: string; amount: number }>,
): Array<{ category: string; total: number }> {
  const map = new Map<string, number>()
  for (const e of expenses) {
    map.set(e.category, round2((map.get(e.category) ?? 0) + Number(e.amount)))
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((x, y) => y.total - x.total)
}

/** Devuelve el prefijo YYYY-MM de una fecha ISO. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}
