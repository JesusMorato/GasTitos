import { describe, expect, it } from 'vitest'
import { boldParts, computeInsights, insightsSignature, myItems, type InsightInput, type MyItem } from './insights'

const names: Record<string, string> = { comida: 'Comida', ocio: 'Ocio', casa: 'Casa' }
const item = (spent_on: string, amount: number, category_id: string, fixed = false): MyItem => ({
  id: `${spent_on}-${amount}`, spent_on, amount, category_id, fixed, description: null, origin: 'personal', full_amount: amount,
})

function input(items: MyItem[], extra: Partial<InsightInput> = {}): InsightInput {
  return { items, today: '2026-09-15', categoryName: (id) => names[id] ?? id, limit: null, fixedMonthly: 0, goals: [], ...extra }
}
const ids = (inp: InsightInput) => computeInsights(inp).map((i) => i.id)

describe('myItems', () => {
  it('cuenta personal entero, mi parte del repartido y mi % de la conjunta', () => {
    const base = { spent_on: '2026-09-01', category_id: 'comida', recurring_id: null, shares: [] }
    const out = myItems(
      [
        { ...base, user_id: 'yo', amount: 10, is_shared: false, funding: 'personal' },
        { ...base, user_id: 'otra', amount: 99, is_shared: false, funding: 'personal' },
        { ...base, user_id: 'otra', amount: 40, is_shared: true, funding: 'personal', shares: [{ user_id: 'yo', amount: 15 }, { user_id: 'otra', amount: 25 }] },
        { ...base, user_id: 'otra', amount: 100, is_shared: true, funding: 'pot', recurring_id: 'r1' },
      ],
      'yo',
      0.6,
    )
    expect(out.map((x) => x.amount)).toEqual([10, 15, 60])
    expect(out[2].fixed).toBe(true)
  })
})

describe('computeInsights', () => {
  it('sin gastos lo dice y no marca nada importante', () => {
    const r = computeInsights(input([]))
    expect(r.map((i) => i.id)).toContain('mes-vacio')
    expect(r.some((i) => i.important)).toBe(false)
  })

  it('compara con el mes pasado a estas alturas (no con el mes entero)', () => {
    const items = [
      item('2026-08-05', 100, 'comida'),
      item('2026-08-28', 500, 'comida'), // después del día 15: no cuenta
      item('2026-09-05', 200, 'comida'),
    ]
    const r = computeInsights(input(items))
    const mes = r.find((i) => i.id === 'mes-sube')!
    expect(mes.important).toBe(true)
    expect(mes.text).toContain('100,00')
    expect(r.find((i) => i.id === 'cat-sube:comida')?.tone).toBe('warn')
  })

  it('detecta las bajadas por categoría', () => {
    const items = [item('2026-08-03', 120, 'ocio'), item('2026-09-03', 40, 'ocio')]
    expect(ids(input(items))).toContain('cat-baja:ocio')
  })

  it('ignora diferencias pequeñas', () => {
    const items = [item('2026-08-03', 100, 'ocio'), item('2026-09-03', 110, 'ocio')]
    const r = ids(input(items))
    expect(r).toContain('mes-igual')
    expect(r.some((id) => id.startsWith('cat-sube') || id.startsWith('cat-baja'))).toBe(false)
  })

  it('avisa del límite superado o por encima del ritmo', () => {
    const items = [item('2026-09-02', 700, 'casa')]
    expect(ids(input(items, { limit: 600 }))).toContain('limite-superado')
    expect(ids(input(items, { limit: 1000 }))).toContain('limite-ritmo')
    expect(ids(input([item('2026-09-02', 100, 'casa')], { limit: 1000 }))).toContain('limite-bien')
  })

  it('propone recortar el mayor gasto variable, sin contar los fijos', () => {
    const items = [
      item('2026-07-01', 800, 'casa', true),
      item('2026-07-10', 300, 'comida'),
      item('2026-08-10', 300, 'comida'),
      item('2026-08-01', 800, 'casa', true),
    ]
    const r = computeInsights(input(items, { fixedMonthly: 800 }))
    const recorte = r.find((i) => i.id.startsWith('ahorro-recorte'))!
    expect(recorte.id).toBe('ahorro-recorte:comida')
    expect(recorte.text).toContain('360,00') // 300 × 10 % × 12
    expect(r.map((i) => i.id)).toContain('ahorro-fijos')
  })

  it('calcula lo que toca meter en una hucha con fecha', () => {
    const r = computeInsights(input([], { today: '2026-09-15', goals: [{ name: 'Viaje', target: 1000, saved: 400, deadline: '2027-03-01' }] }))
    expect(r.find((i) => i.id === 'hucha-plan:Viaje')?.text).toContain('100,00') // 600 / 6 meses
  })

  it('la huella solo cambia con los avisos importantes', () => {
    const items = [item('2026-09-02', 700, 'casa')]
    const a = insightsSignature(computeInsights(input(items, { limit: 600 })), '2026-09-15')
    expect(a).toContain('limite-superado')
    expect(insightsSignature(computeInsights(input([])), '2026-09-15')).toBe('')
  })
})

describe('boldParts', () => {
  it('separa las negritas', () => {
    expect(boldParts('Llevas **10 €** hoy')).toEqual([
      { text: 'Llevas ', bold: false },
      { text: '10 €', bold: true },
      { text: ' hoy', bold: false },
    ])
  })
})
