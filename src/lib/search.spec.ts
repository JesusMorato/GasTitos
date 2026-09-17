import { describe, expect, it } from 'vitest'
import { EMPTY_FILTER, filterExpenses, groupByMonth, isEmptyFilter, normalize } from './search'

const names: Record<string, string> = { c1: 'Comida', c2: 'Ocio' }
const rows = [
  { id: 'a', amount: 12.5, spent_on: '2026-09-03', category_id: 'c1', description: 'Cañas del viernes', is_shared: false, funding: 'personal' as const },
  { id: 'b', amount: 80, spent_on: '2026-08-20', category_id: 'c2', description: null, is_shared: true, funding: 'personal' as const },
  { id: 'c', amount: 200, spent_on: '2026-08-02', category_id: 'c1', description: 'Súper', is_shared: true, funding: 'pot' as const },
]
const name = (id: string) => names[id] ?? ''
const ids = (f: Partial<typeof EMPTY_FILTER>) => filterExpenses(rows, { ...EMPTY_FILTER, ...f }, name).map((r) => r.id)

describe('buscador', () => {
  it('normaliza tildes y mayúsculas', () => {
    expect(normalize('  CAÑAS Súper ')).toBe('canas super')
  })

  it('busca en la nota y en la categoría, palabra a palabra', () => {
    expect(ids({ text: 'canas' })).toEqual(['a'])
    expect(ids({ text: 'ocio' })).toEqual(['b'])
    expect(ids({ text: 'comida viernes' })).toEqual(['a'])
    expect(ids({ text: 'nada' })).toEqual([])
  })

  it('filtra por categoría, tipo e importe', () => {
    expect(ids({ categoryIds: ['c1'] })).toEqual(['a', 'c'])
    expect(ids({ kinds: ['shared'] })).toEqual(['b'])
    expect(ids({ kinds: ['pot', 'personal'] })).toEqual(['a', 'c'])
    expect(ids({ min: 50 })).toEqual(['b', 'c'])
    expect(ids({ max: 50 })).toEqual(['a'])
    expect(ids({ min: 50, max: 100 })).toEqual(['b'])
  })

  it('sin filtros devuelve todo', () => {
    expect(ids({})).toEqual(['a', 'b', 'c'])
    expect(isEmptyFilter(EMPTY_FILTER)).toBe(true)
    expect(isEmptyFilter({ ...EMPTY_FILTER, text: ' ' })).toBe(true)
    expect(isEmptyFilter({ ...EMPTY_FILTER, min: 0 })).toBe(false)
  })

  it('agrupa por mes, del más reciente al más antiguo, con totales', () => {
    const g = groupByMonth(rows)
    expect(g.map((x) => x.month)).toEqual(['2026-09', '2026-08'])
    expect(g[1].total).toBe(280)
    expect(g[1].rows.map((r) => r.id)).toEqual(['b', 'c'])
  })
})
