// Pagos detectados: reglas puras para proponer tipo y categoría.
import type { DetectedPayment, Expense, PaymentKind } from '../types'

/** Tipo de gasto que se propone para una tarjeta: lo que eligió el usuario en Ajustes
 *  o, si no hay nada, Revolut → cuenta conjunta y el resto → personal. */
export function suggestKind(card: string, cardKinds: Record<string, PaymentKind>): PaymentKind {
  const key = Object.keys(cardKinds).find((k) => k.trim().toLowerCase() === card.trim().toLowerCase())
  if (key) return cardKinds[key]
  return /revolut/i.test(card) ? 'pot' : 'personal'
}

/** Categoría del último gasto que se apuntó desde un pago del mismo comercio, o null. */
export function suggestCategory(merchant: string, detected: DetectedPayment[], expenseById: Record<string, Expense>): string | null {
  const m = normalize(merchant)
  if (!m) return null
  const done = detected
    .filter((d) => d.status === 'done' && d.expense_id && normalize(d.merchant) === m)
    .sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1))
  for (const d of done) {
    const e = expenseById[d.expense_id!]
    if (e) return e.category_id
  }
  return null
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
