import { describe, expect, it } from 'vitest'
import { cardsSeen, newToken, remembered, suggestCategory, suggestKind } from './payments'
import type { DetectedPayment, Expense } from '../types'

function pay(p: Partial<DetectedPayment>): DetectedPayment {
  return {
    id: 'p', household_id: 'h', user_id: 'u', amount: 10, merchant: '', card: '', paid_at: '2026-09-01T10:00:00Z',
    status: 'pending', expense_id: null, created_at: '2026-09-01T10:00:00Z', ...p,
  }
}
function exp(id: string, category_id: string, extra: Partial<Expense> = {}): Expense {
  return {
    id, household_id: 'h', user_id: 'u', amount: 10, spent_on: '2026-09-01', category_id, description: null,
    is_shared: false, is_public: false, funding: 'personal', split_mode: 'household', recurring_id: null, created_at: '', ...extra,
  }
}

describe('suggestKind', () => {
  it('usa lo elegido en Ajustes, sin distinguir mayúsculas', () => {
    expect(suggestKind('Bankinter Visa', { 'bankinter visa': 'shared' })).toBe('shared')
  })
  it('sin ajuste: Revolut → conjunta, el resto → personal', () => {
    expect(suggestKind('Revolut', {})).toBe('pot')
    expect(suggestKind('Bankinter', {})).toBe('personal')
  })
  it('lo recordado del comercio manda sobre la tarjeta', () => {
    expect(suggestKind('Revolut', { revolut: 'pot' }, { category_id: 'c', kind: 'shared', split_mode: 'household' })).toBe('shared')
  })
})

describe('remembered', () => {
  it('devuelve categoría, tipo y reparto del último gasto apuntado del comercio', () => {
    const expenses = { e1: exp('e1', 'super', { is_shared: true, funding: 'personal', split_mode: 'custom' }) }
    const detected = [pay({ merchant: 'Mercadona', status: 'done', expense_id: 'e1' })]
    expect(remembered('mercadona', detected, expenses)).toEqual({ category_id: 'super', kind: 'shared', split_mode: 'custom' })
  })
  it('gasto de la cuenta conjunta → pot', () => {
    const expenses = { e1: exp('e1', 'casa', { is_shared: true, funding: 'pot' }) }
    const detected = [pay({ merchant: 'Ikea', status: 'done', expense_id: 'e1' })]
    expect(remembered('Ikea', detected, expenses)?.kind).toBe('pot')
  })
})

describe('suggestCategory', () => {
  const expenses = { e1: exp('e1', 'super'), e2: exp('e2', 'ocio') }
  it('devuelve la categoría del último pago apuntado del mismo comercio', () => {
    const detected = [
      pay({ id: 'a', merchant: 'Mercadona', status: 'done', expense_id: 'e2', paid_at: '2026-08-01T10:00:00Z' }),
      pay({ id: 'b', merchant: 'MERCADONA ', status: 'done', expense_id: 'e1', paid_at: '2026-09-01T10:00:00Z' }),
    ]
    expect(suggestCategory('mercadona', detected, expenses)).toBe('super')
  })
  it('ignora los pendientes y descartados', () => {
    const detected = [pay({ merchant: 'Zara', status: 'dismissed', expense_id: null })]
    expect(suggestCategory('Zara', detected, expenses)).toBeNull()
  })
  it('ignora pagos cuyo gasto ya no existe', () => {
    const detected = [pay({ merchant: 'Zara', status: 'done', expense_id: 'borrado' })]
    expect(suggestCategory('Zara', detected, expenses)).toBeNull()
  })
  it('comercio vacío → null', () => {
    expect(suggestCategory('  ', [], expenses)).toBeNull()
  })
})

describe('cardsSeen', () => {
  it('lista tarjetas únicas, la más reciente primero', () => {
    const detected = [
      pay({ card: 'Bankinter', paid_at: '2026-09-01T10:00:00Z' }),
      pay({ card: 'Revolut', paid_at: '2026-09-02T10:00:00Z' }),
      pay({ card: 'bankinter', paid_at: '2026-09-03T10:00:00Z' }),
      pay({ card: '', paid_at: '2026-09-04T10:00:00Z' }),
    ]
    expect(cardsSeen(detected)).toEqual(['bankinter', 'Revolut'])
  })
})

describe('newToken', () => {
  it('tiene 24 caracteres del alfabeto sin confusiones', () => {
    const t = newToken((n) => Array.from({ length: n }, (_, i) => i * 7))
    expect(t).toHaveLength(24)
    expect(t).toMatch(/^[abcdefghjkmnpqrstuvwxyz23456789]+$/)
  })
  it('usa crypto por defecto', () => {
    expect(newToken()).toHaveLength(24)
  })
})
