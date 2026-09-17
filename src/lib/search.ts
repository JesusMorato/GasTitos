// Filtro de gastos del buscador. Puro y testeado (search.spec.ts).
import { monthOf } from './money'

export type ExpenseKind = 'personal' | 'shared' | 'pot'

export interface SearchableExpense {
  amount: number
  spent_on: string
  category_id: string
  description: string | null
  is_shared: boolean
  funding: 'personal' | 'pot'
}

export interface SearchFilter {
  /** Texto libre: se busca en la nota y en el nombre de la categoría, sin acentos ni mayúsculas. */
  text: string
  /** Vacío = todas. */
  categoryIds: string[]
  /** Vacío = todos. */
  kinds: ExpenseKind[]
  min: number | null
  max: number | null
}

export const EMPTY_FILTER: SearchFilter = { text: '', categoryIds: [], kinds: [], min: null, max: null }

export function kindOf(e: { is_shared: boolean; funding: 'personal' | 'pot' }): ExpenseKind {
  return !e.is_shared ? 'personal' : e.funding === 'pot' ? 'pot' : 'shared'
}

/** "Cañas del viernes" → "canas del viernes" (para comparar sin tildes). */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function filterExpenses<T extends SearchableExpense>(
  rows: T[],
  f: SearchFilter,
  categoryName: (id: string) => string,
): T[] {
  const words = normalize(f.text).split(/\s+/).filter(Boolean)
  return rows.filter((e) => {
    if (f.categoryIds.length && !f.categoryIds.includes(e.category_id)) return false
    if (f.kinds.length && !f.kinds.includes(kindOf(e))) return false
    if (f.min != null && e.amount < f.min) return false
    if (f.max != null && e.amount > f.max) return false
    if (words.length) {
      const hay = normalize(`${e.description ?? ''} ${categoryName(e.category_id)}`)
      if (!words.every((w) => hay.includes(w))) return false
    }
    return true
  })
}

/** Agrupa por mes (del más reciente al más antiguo) con el total de cada uno. */
export function groupByMonth<T extends { spent_on: string; amount: number }>(rows: T[]): Array<{ month: string; total: number; rows: T[] }> {
  const map = new Map<string, T[]>()
  for (const r of rows) {
    const k = monthOf(r.spent_on)
    ;(map.get(k) ?? map.set(k, []).get(k)!).push(r)
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, list]) => ({
      month,
      total: Math.round(list.reduce((a, r) => a + r.amount, 0) * 100) / 100,
      rows: [...list].sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1)),
    }))
}

export function isEmptyFilter(f: SearchFilter): boolean {
  return !f.text.trim() && f.categoryIds.length === 0 && f.kinds.length === 0 && f.min == null && f.max == null
}
