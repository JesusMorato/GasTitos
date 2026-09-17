import { describe, expect, it } from 'vitest'
import { breakdownBy } from './breakdown'

const g = (key: string, id: string, amount: number, date: string) => ({ key, id, label: id, amount, date })

describe('breakdownBy', () => {
  it('agrupa por categoría y suma con céntimos exactos', () => {
    const rows = breakdownBy([g('casa', 'a', 0.1, '2026-09-01'), g('casa', 'b', 0.2, '2026-09-02'), g('ocio', 'c', 5, '2026-09-03')])
    expect(rows.map((r) => [r.key, r.total])).toEqual([['ocio', 5], ['casa', 0.3]])
  })

  it('ordena las filas de mayor a menor y los gastos del más reciente al más antiguo', () => {
    const rows = breakdownBy([g('casa', 'viejo', 10, '2026-09-01'), g('casa', 'nuevo', 1, '2026-09-20'), g('ocio', 'x', 50, '2026-09-05')])
    expect(rows[0].key).toBe('ocio')
    expect(rows[1].items.map((i) => i.id)).toEqual(['nuevo', 'viejo'])
  })

  it('respeta el límite de filas y no mete la clave en los gastos', () => {
    const rows = breakdownBy([g('a', '1', 1, '2026-09-01'), g('b', '2', 2, '2026-09-01'), g('c', '3', 3, '2026-09-01')], 2)
    expect(rows).toHaveLength(2)
    expect(rows[0].items[0]).not.toHaveProperty('key')
  })
})
