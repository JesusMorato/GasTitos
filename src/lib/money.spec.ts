import { describe, it, expect } from 'vitest'
import { computeBalance, goalProgress, sum, totalsByCategory, formatDate, monthOf } from './money'

const A = 'user-a'
const B = 'user-b'

describe('computeBalance', () => {
  it('sin gastos compartidos no hay deuda', () => {
    const r = computeBalance([{ user_id: A, amount: 50, is_shared: false }], [A, B])
    expect(r.total).toBe(0)
    expect(r.settlement).toBeNull()
  })

  it('quien paga menos debe la mitad de la diferencia', () => {
    const r = computeBalance(
      [
        { user_id: A, amount: 100, is_shared: true },
        { user_id: B, amount: 40, is_shared: true },
      ],
      [A, B],
    )
    expect(r.total).toBe(140)
    expect(r.paidBy[A]).toBe(100)
    expect(r.paidBy[B]).toBe(40)
    expect(r.settlement).toEqual({ from: B, to: A, amount: 30 })
  })

  it('funciona en la otra dirección', () => {
    const r = computeBalance(
      [
        { user_id: A, amount: 10, is_shared: true },
        { user_id: B, amount: 30, is_shared: true },
      ],
      [A, B],
    )
    expect(r.settlement).toEqual({ from: A, to: B, amount: 10 })
  })

  it('a la par no devuelve liquidación', () => {
    const r = computeBalance(
      [
        { user_id: A, amount: 25, is_shared: true },
        { user_id: B, amount: 25, is_shared: true },
      ],
      [A, B],
    )
    expect(r.settlement).toBeNull()
  })

  it('ignora los gastos individuales', () => {
    const r = computeBalance(
      [
        { user_id: A, amount: 500, is_shared: false },
        { user_id: B, amount: 20, is_shared: true },
      ],
      [A, B],
    )
    expect(r.total).toBe(20)
    expect(r.settlement).toEqual({ from: A, to: B, amount: 10 })
  })

  it('redondea a céntimos', () => {
    const r = computeBalance([{ user_id: A, amount: 0.01, is_shared: true }], [A, B])
    expect(r.settlement?.amount).toBe(0.01)
  })
})

describe('goalProgress', () => {
  it('calcula la fracción', () => {
    expect(goalProgress(250, 1000)).toBe(0.25)
  })
  it('objetivo 0 devuelve 0', () => {
    expect(goalProgress(10, 0)).toBe(0)
  })
})

describe('sum y totalsByCategory', () => {
  it('suma con decimales sin errores de coma flotante', () => {
    expect(sum([0.1, 0.2])).toBe(0.3)
  })
  it('agrupa y ordena por categoría', () => {
    const r = totalsByCategory([
      { category: 'Comida', amount: 10 },
      { category: 'Ocio', amount: 30 },
      { category: 'Comida', amount: 5 },
    ])
    expect(r).toEqual([
      { category: 'Ocio', total: 30 },
      { category: 'Comida', total: 15 },
    ])
  })
})

describe('fechas', () => {
  it('formatea a dd/mm/yyyy', () => {
    expect(formatDate('2026-09-15')).toBe('15/09/2026')
  })
  it('extrae el mes', () => {
    expect(monthOf('2026-09-15')).toBe('2026-09')
  })
})
