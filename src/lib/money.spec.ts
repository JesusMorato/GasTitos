import { describe, it, expect } from 'vitest'
import {
  computeBalance, computeShares, describeSplit, goalProgress, myShareTotal, paidByMember,
  sharesAreValid, splitByPct, sum, totalsBy, formatDate, monthOf,
} from './money'

const A = 'user-a'
const B = 'user-b'
const members = [
  { user_id: A, share_pct: 50 },
  { user_id: B, share_pct: 50 },
]
const members6040 = [
  { user_id: A, share_pct: 60 },
  { user_id: B, share_pct: 40 },
]

function shared(payer: string, amount: number, shares: Array<[string, number]>) {
  return {
    user_id: payer, amount, is_shared: true, funding: 'personal' as const,
    shares: shares.map(([user_id, a]) => ({ user_id, amount: a })),
  }
}

describe('splitByPct', () => {
  it('reparte a medias con céntimos impares sin perder nada', () => {
    const r = splitByPct(10.01, [{ user_id: A, pct: 50 }, { user_id: B, pct: 50 }])
    expect(r.map((s) => s.amount)).toEqual([5.01, 5])
    expect(sum(r.map((s) => s.amount))).toBe(10.01)
  })
  it('reparte 60/40', () => {
    const r = splitByPct(100, [{ user_id: A, pct: 60 }, { user_id: B, pct: 40 }])
    expect(r).toEqual([{ user_id: A, amount: 60 }, { user_id: B, amount: 40 }])
  })
  it('siempre suma el importe aunque los porcentajes sean raros', () => {
    const r = splitByPct(33.33, [{ user_id: A, pct: 33 }, { user_id: B, pct: 67 }])
    expect(sum(r.map((s) => s.amount))).toBe(33.33)
  })
})

describe('computeShares', () => {
  it('household usa el porcentaje del hogar', () => {
    expect(computeShares(100, 'household', members6040, A)).toEqual([
      { user_id: A, amount: 60 }, { user_id: B, amount: 40 },
    ])
  })
  it('equal ignora el porcentaje del hogar', () => {
    expect(computeShares(100, 'equal', members6040, A)).toEqual([
      { user_id: A, amount: 50 }, { user_id: B, amount: 50 },
    ])
  })
  it('custom: el porcentaje es el del pagador', () => {
    expect(computeShares(100, 'custom', members, B, { customPct: 30 })).toEqual([
      { user_id: A, amount: 70 }, { user_id: B, amount: 30 },
    ])
  })
  it('exact usa los importes dados', () => {
    expect(computeShares(50, 'exact', members, A, { exact: { [A]: 12.5, [B]: 37.5 } })).toEqual([
      { user_id: A, amount: 12.5 }, { user_id: B, amount: 37.5 },
    ])
  })
  it('other_only: todo para el otro', () => {
    expect(computeShares(80, 'other_only', members, A)).toEqual([
      { user_id: A, amount: 0 }, { user_id: B, amount: 80 },
    ])
  })
})

describe('sharesAreValid', () => {
  it('acepta cuando suman el importe', () => {
    expect(sharesAreValid(10, [{ user_id: A, amount: 4 }, { user_id: B, amount: 6 }])).toBe(true)
  })
  it('rechaza cuando no suman', () => {
    expect(sharesAreValid(10, [{ user_id: A, amount: 4 }, { user_id: B, amount: 5 }])).toBe(false)
  })
  it('rechaza partes negativas', () => {
    expect(sharesAreValid(10, [{ user_id: A, amount: -2 }, { user_id: B, amount: 12 }])).toBe(false)
  })
})

describe('computeBalance', () => {
  it('sin gastos repartidos no hay deuda', () => {
    const r = computeBalance([{ user_id: A, amount: 50, is_shared: false, funding: 'personal', shares: [] }], [], [A, B])
    expect(r.settlement).toBeNull()
  })

  it('A paga 100 a medias: B debe 50 a A', () => {
    const r = computeBalance([shared(A, 100, [[A, 50], [B, 50]])], [], [A, B])
    expect(r.net[A]).toBe(50)
    expect(r.net[B]).toBe(-50)
    expect(r.settlement).toEqual({ from: B, to: A, amount: 50 })
  })

  it('repartos mixtos se acumulan correctamente', () => {
    const r = computeBalance(
      [
        shared(A, 100, [[A, 60], [B, 40]]),   // B debe 40
        shared(B, 30, [[A, 15], [B, 15]]),    // A debe 15
        shared(A, 20, [[A, 0], [B, 20]]),     // B debe 20
      ],
      [],
      [A, B],
    )
    expect(r.settlement).toEqual({ from: B, to: A, amount: 45 })
  })

  it('una liquidación pone el balance a cero', () => {
    const r = computeBalance(
      [shared(A, 100, [[A, 50], [B, 50]])],
      [{ from_user: B, to_user: A, amount: 50 }],
      [A, B],
    )
    expect(r.settlement).toBeNull()
  })

  it('una liquidación parcial reduce la deuda', () => {
    const r = computeBalance(
      [shared(A, 100, [[A, 50], [B, 50]])],
      [{ from_user: B, to_user: A, amount: 20 }],
      [A, B],
    )
    expect(r.settlement).toEqual({ from: B, to: A, amount: 30 })
  })

  it('los gastos del bote no cuentan para el balance', () => {
    const r = computeBalance(
      [{ user_id: A, amount: 500, is_shared: true, funding: 'pot', shares: [] }],
      [],
      [A, B],
    )
    expect(r.settlement).toBeNull()
  })

  it('funciona en la otra dirección', () => {
    const r = computeBalance([shared(B, 30, [[A, 15], [B, 15]])], [], [A, B])
    expect(r.settlement).toEqual({ from: A, to: B, amount: 15 })
  })
})

describe('paidByMember y myShareTotal', () => {
  const xs = [
    shared(A, 100, [[A, 60], [B, 40]]),
    shared(B, 30, [[A, 15], [B, 15]]),
    { user_id: A, amount: 999, is_shared: true, funding: 'pot' as const, shares: [] },
  ]
  it('quién ha pagado cuánto (sin bote)', () => {
    expect(paidByMember(xs, [A, B])).toEqual({ [A]: 100, [B]: 30 })
  })
  it('mi parte suma lo que me tocaba, pagase quien pagase', () => {
    expect(myShareTotal(xs, A)).toBe(75)
    expect(myShareTotal(xs, B)).toBe(55)
  })
})

describe('describeSplit', () => {
  const nameOf = (id: string) => (id === A ? 'Ana' : 'Luis')
  it('a medias', () => {
    expect(describeSplit('equal', [{ user_id: A, amount: 5 }, { user_id: B, amount: 5 }], 10, A, nameOf)).toBe('a medias')
  })
  it('porcentajes', () => {
    expect(describeSplit('custom', [{ user_id: A, amount: 7 }, { user_id: B, amount: 3 }], 10, A, nameOf)).toBe('70/30')
  })
  it('solo el otro', () => {
    expect(describeSplit('other_only', [{ user_id: A, amount: 0 }, { user_id: B, amount: 10 }], 10, A, nameOf)).toBe('todo para Luis')
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

describe('sum y totalsBy', () => {
  it('suma con decimales sin errores de coma flotante', () => {
    expect(sum([0.1, 0.2])).toBe(0.3)
  })
  it('agrupa y ordena', () => {
    const r = totalsBy(
      [{ c: 'Comida', a: 10 }, { c: 'Ocio', a: 30 }, { c: 'Comida', a: 5 }],
      (x) => x.c,
      (x) => x.a,
    )
    expect(r).toEqual([{ key: 'Ocio', total: 30 }, { key: 'Comida', total: 15 }])
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

import { budgetStatus, cumulativeByDay, dayCursor, daysInMonth, lastMonths, totalsByMonth } from './money'

describe('meses', () => {
  it('días del mes, con febrero bisiesto', () => {
    expect(daysInMonth('2026-09')).toBe(30)
    expect(daysInMonth('2028-02')).toBe(29)
    expect(daysInMonth('2026-02')).toBe(28)
  })
  it('últimos 6 meses cruzando el año', () => {
    expect(lastMonths('2026-02', 6)).toEqual(['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('totales por mes con ceros', () => {
    const r = totalsByMonth(
      [{ spent_on: '2026-08-03', amount: 10 }, { spent_on: '2026-08-20', amount: 5.5 }, { spent_on: '2026-06-01', amount: 1 }],
      ['2026-06', '2026-07', '2026-08'],
    )
    expect(r).toEqual([1, 0, 15.5])
  })
})

describe('cumulativeByDay', () => {
  it('acumula por día y devuelve un valor por cada día del mes', () => {
    const r = cumulativeByDay(
      [{ spent_on: '2026-09-01', amount: 10 }, { spent_on: '2026-09-03', amount: 5 }, { spent_on: '2026-09-03', amount: 2.5 }, { spent_on: '2026-10-01', amount: 99 }],
      '2026-09',
    )
    expect(r.length).toBe(30)
    expect(r.slice(0, 4)).toEqual([10, 10, 17.5, 17.5])
    expect(r[29]).toBe(17.5)
  })
})

describe('dayCursor', () => {
  it('mes actual → día de hoy', () => {
    expect(dayCursor('2026-09', '2026-09-16')).toBe(16)
  })
  it('mes pasado → último día; futuro → 0', () => {
    expect(dayCursor('2026-08', '2026-09-16')).toBe(31)
    expect(dayCursor('2026-10', '2026-09-16')).toBe(0)
  })
})

describe('budgetStatus', () => {
  it('por debajo del ritmo', () => {
    const s = budgetStatus(200, 900, 10, 30)
    expect(s.state).toBe('under')
    expect(s.paceAllowed).toBe(300)
    expect(s.remaining).toBe(700)
    expect(s.daysLeft).toBe(20)
    expect(s.perDay).toBe(35)
  })
  it('por encima del ritmo pero sin pasarse', () => {
    const s = budgetStatus(500, 900, 10, 30)
    expect(s.state).toBe('over_pace')
    expect(s.exceeded).toBe(0)
  })
  it('límite superado', () => {
    const s = budgetStatus(950, 900, 28, 30)
    expect(s.state).toBe('exceeded')
    expect(s.exceeded).toBe(50)
    expect(s.remaining).toBe(0)
    expect(s.perDay).toBe(0)
  })
  it('último día: lo que queda es lo que puedes gastar hoy', () => {
    const s = budgetStatus(800, 900, 30, 30)
    expect(s.daysLeft).toBe(0)
    expect(s.perDay).toBe(100)
  })
})
