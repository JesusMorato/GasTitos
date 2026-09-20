// Pagos detectados: reglas puras para proponer tipo y categoría.
import type { DetectedPayment, Expense, PaymentKind } from '../types'

/** Lo que se recuerda de la última vez que se apuntó un pago del mismo comercio. */
export interface Remembered {
  category_id: string
  kind: PaymentKind
  split_mode: Expense['split_mode']
}

/** Último gasto apuntado desde un pago del mismo comercio: su categoría, tipo y reparto. */
export function remembered(merchant: string, detected: DetectedPayment[], expenseById: Record<string, Expense>): Remembered | null {
  const m = normalize(merchant)
  if (!m) return null
  const done = detected
    .filter((d) => d.status === 'done' && d.expense_id && normalize(d.merchant) === m)
    .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))
  for (const d of done) {
    const e = expenseById[d.expense_id!]
    if (e) return { category_id: e.category_id, kind: kindOfExpense(e), split_mode: e.split_mode }
  }
  return null
}

export function kindOfExpense(e: Pick<Expense, 'is_shared' | 'funding'>): PaymentKind {
  if (!e.is_shared) return 'personal'
  return e.funding === 'pot' ? 'pot' : 'shared'
}

/** Tipo de gasto que se propone: lo recordado del comercio; si no, lo elegido en Ajustes
 *  para la tarjeta; si no, Revolut → cuenta conjunta y el resto → personal. */
export function suggestKind(card: string, cardKinds: Record<string, PaymentKind>, memory?: Remembered | null): PaymentKind {
  if (memory) return memory.kind
  const key = Object.keys(cardKinds).find((k) => k.trim().toLowerCase() === card.trim().toLowerCase())
  if (key) return cardKinds[key]
  return /revolut/i.test(card) ? 'pot' : 'personal'
}

/** Categoría del último gasto que se apuntó desde un pago del mismo comercio, o null. */
export function suggestCategory(merchant: string, detected: DetectedPayment[], expenseById: Record<string, Expense>): string | null {
  return remembered(merchant, detected, expenseById)?.category_id ?? null
}

/** Tarjetas distintas que han aparecido en los pagos, la más reciente primero. */
export function cardsSeen(detected: DetectedPayment[]): string[] {
  const out: string[] = []
  for (const d of [...detected].sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))) {
    const c = d.card.trim()
    if (c && !out.some((x) => x.toLowerCase() === c.toLowerCase())) out.push(c)
  }
  return out
}

/** Código secreto para el atajo: 24 caracteres sin confusiones (sin 0/O ni 1/l). */
export function newToken(random: (n: number) => number[] = cryptoRandom): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return random(24).map((n) => alphabet[n % alphabet.length]).join('')
}

function cryptoRandom(n: number): number[] {
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return Array.from(buf)
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}
