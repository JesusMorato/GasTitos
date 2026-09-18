// Utilidades de dinero puras (sin Vue ni Supabase) para poder testearlas fácil.
import type { SplitMode } from '../types'

export function formatEur(amount: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount)
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function todayIso(): string {
  return localIso(new Date())
}

/** Fecha (AAAA-MM-DD) de un instante, en la zona horaria del dispositivo. */
export function localIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function sum(values: number[]): number {
  return round2(values.reduce((acc, v) => acc + Number(v), 0))
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
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

/** Progreso de un objetivo, entre 0 y 1 (puede superar 1 si se pasa). */
export function goalProgress(saved: number, target: number): number {
  if (target <= 0) return 0
  return round2(saved / target)
}

/** Agrupa importes por clave, ordenado de mayor a menor. */
export function totalsBy<T>(
  items: T[],
  key: (item: T) => string,
  amount: (item: T) => number,
): Array<{ key: string; total: number }> {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    map.set(k, round2((map.get(k) ?? 0) + Number(amount(it))))
  }
  return [...map.entries()]
    .map(([k, total]) => ({ key: k, total }))
    .sort((x, y) => y.total - x.total)
}

// ------------------------------------------------------------
// Reparto
// ------------------------------------------------------------

export interface Share {
  user_id: string
  amount: number
}

/**
 * Reparte un importe entre varias personas según porcentajes.
 * Redondea a céntimos y asigna el resto (si lo hay) a la primera persona,
 * de forma que las partes siempre suman exactamente el importe.
 */
export function splitByPct(amount: number, pcts: Array<{ user_id: string; pct: number }>): Share[] {
  const totalPct = pcts.reduce((a, p) => a + p.pct, 0)
  if (pcts.length === 0 || totalPct <= 0) return []
  const cents = Math.round(amount * 100)
  const shares = pcts.map((p) => ({ user_id: p.user_id, cents: Math.floor((cents * p.pct) / totalPct) }))
  let rest = cents - shares.reduce((a, s) => a + s.cents, 0)
  for (let i = 0; rest > 0; i = (i + 1) % shares.length) {
    shares[i].cents += 1
    rest -= 1
  }
  return shares.map((s) => ({ user_id: s.user_id, amount: s.cents / 100 }))
}

/**
 * Calcula las partes de un gasto repartido según el modo elegido.
 *  - household: porcentaje del hogar (share_pct de cada miembro)
 *  - equal:     a medias
 *  - custom:    porcentaje a medida (customPct = % del pagador)
 *  - exact:     importes exactos (exact = importe de cada uno)
 *  - other_only: todo para el otro (el pagador no se queda nada)
 */
export function computeShares(
  amount: number,
  mode: SplitMode,
  members: ReadonlyArray<{ user_id: string; share_pct: number }>,
  payerId: string,
  opts: { customPct?: number; exact?: Record<string, number> } = {},
): Share[] {
  switch (mode) {
    case 'household':
      return splitByPct(amount, members.map((m) => ({ user_id: m.user_id, pct: m.share_pct })))
    case 'equal':
      return splitByPct(amount, members.map((m) => ({ user_id: m.user_id, pct: 1 })))
    case 'custom': {
      const pct = Math.min(100, Math.max(0, opts.customPct ?? 50))
      return splitByPct(
        amount,
        members.map((m) => ({ user_id: m.user_id, pct: m.user_id === payerId ? pct : 100 - pct })),
      )
    }
    case 'exact':
      return members.map((m) => ({ user_id: m.user_id, amount: round2(opts.exact?.[m.user_id] ?? 0) }))
    case 'other_only':
      return members.map((m) => ({ user_id: m.user_id, amount: m.user_id === payerId ? 0 : amount }))
  }
}

export function sharesAreValid(amount: number, shares: Share[]): boolean {
  return shares.length > 0 && shares.every((s) => s.amount >= 0) && sum(shares.map((s) => s.amount)) === round2(amount)
}

/** Texto corto que describe un reparto: "a medias", "70/30", "solo Luis"… */
export function describeSplit(
  mode: SplitMode,
  shares: Share[],
  amount: number,
  payerId: string,
  nameOf: (id: string) => string,
): string {
  if (mode === 'equal') return 'a medias'
  if (mode === 'other_only') {
    const other = shares.find((s) => s.user_id !== payerId)
    return other ? `todo para ${nameOf(other.user_id)}` : 'todo'
  }
  if (amount <= 0 || shares.length === 0) return ''
  const pct = shares.map((s) => `${Math.round((s.amount / amount) * 100)}`).join('/')
  return mode === 'household' ? `${pct} (hogar)` : pct
}

// ------------------------------------------------------------
// Balance
// ------------------------------------------------------------

export interface BalanceExpense {
  user_id: string
  amount: number
  is_shared: boolean
  funding: 'personal' | 'pot'
  shares: Share[]
}

export interface BalanceSettlement {
  from_user: string
  to_user: string
  amount: number
}

export interface Balance {
  /** Positivo = le deben; negativo = debe. Uno por miembro. */
  net: Record<string, number>
  /** Quién debe a quién para quedar en paz, o null si están a la par. */
  settlement: { from: string; to: string; amount: number } | null
}

/**
 * Balance acumulado de los gastos repartidos (pagados con dinero personal)
 * menos las liquidaciones registradas. Los gastos del bote no cuentan.
 */
export function computeBalance(
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[],
  memberIds: string[],
): Balance {
  const net: Record<string, number> = {}
  for (const id of memberIds) net[id] = 0

  for (const e of expenses) {
    if (!e.is_shared || e.funding !== 'personal') continue
    net[e.user_id] = round2((net[e.user_id] ?? 0) + Number(e.amount))
    for (const s of e.shares) {
      net[s.user_id] = round2((net[s.user_id] ?? 0) - Number(s.amount))
    }
  }
  for (const s of settlements) {
    net[s.from_user] = round2((net[s.from_user] ?? 0) + Number(s.amount))
    net[s.to_user] = round2((net[s.to_user] ?? 0) - Number(s.amount))
  }

  if (memberIds.length !== 2) return { net, settlement: null }
  const [a, b] = memberIds
  if (net[a] > 0.005) return { net, settlement: { from: b, to: a, amount: net[a] } }
  if (net[b] > 0.005) return { net, settlement: { from: a, to: b, amount: net[b] } }
  return { net, settlement: null }
}

/** Cuánto ha pagado cada miembro (solo repartidos con dinero personal). */
export function paidByMember(expenses: BalanceExpense[], memberIds: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of memberIds) out[id] = 0
  for (const e of expenses) {
    if (!e.is_shared || e.funding !== 'personal') continue
    out[e.user_id] = round2((out[e.user_id] ?? 0) + Number(e.amount))
  }
  return out
}

/** Mi parte de los gastos repartidos (lo que me tocaba, pagase quien pagase). */
export function myShareTotal(expenses: BalanceExpense[], userId: string): number {
  let total = 0
  for (const e of expenses) {
    if (!e.is_shared || e.funding !== 'personal') continue
    for (const s of e.shares) if (s.user_id === userId) total += Number(s.amount)
  }
  return round2(total)
}

// ------------------------------------------------------------
// Meses, acumulados y límite mensual
// ------------------------------------------------------------

/** Días que tiene un mes YYYY-MM. */
export function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m, 0).getDate()
}

/** Los últimos n meses terminando en `yyyymm`, del más antiguo al más reciente. */
export function lastMonths(yyyymm: string, n: number): string[] {
  const [y, m] = yyyymm.split('-').map(Number)
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

/** Etiqueta corta de un mes: "sep", "oct"… (con año si cambia de año). */
export function shortMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')
}

/** Total por mes para una lista de meses (0 si no hay nada). */
export function totalsByMonth(items: Array<{ spent_on: string; amount: number }>, months: string[]): number[] {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = monthOf(it.spent_on)
    map.set(k, round2((map.get(k) ?? 0) + Number(it.amount)))
  }
  return months.map((m) => map.get(m) ?? 0)
}

/**
 * Gasto acumulado día a día dentro de un mes. Devuelve un array con tantas
 * posiciones como días tiene el mes; cada posición es lo gastado hasta ese día.
 */
export function cumulativeByDay(items: Array<{ spent_on: string; amount: number }>, yyyymm: string): number[] {
  const days = daysInMonth(yyyymm)
  const perDay = new Array<number>(days).fill(0)
  for (const it of items) {
    if (monthOf(it.spent_on) !== yyyymm) continue
    const d = Number(it.spent_on.slice(8, 10))
    if (d >= 1 && d <= days) perDay[d - 1] += Number(it.amount)
  }
  const out: number[] = []
  let acc = 0
  for (const v of perDay) {
    acc = round2(acc + v)
    out.push(acc)
  }
  return out
}

/**
 * Día "de hoy" dentro de un mes dado: si es el mes actual, el día de hoy; si es
 * un mes pasado, el último día; si es futuro, 0.
 */
export function dayCursor(yyyymm: string, today: string = todayIso()): number {
  const cur = monthOf(today)
  if (yyyymm < cur) return daysInMonth(yyyymm)
  if (yyyymm > cur) return 0
  return Number(today.slice(8, 10))
}

export type BudgetState = 'under' | 'over_pace' | 'exceeded'

export interface BudgetStatus {
  spent: number
  limit: number
  /** Lo que queda hasta el límite (0 si te has pasado). */
  remaining: number
  /** Cuánto te has pasado (0 si no). */
  exceeded: number
  /** Días que quedan del mes después de hoy. */
  daysLeft: number
  /** Lo que puedes gastar por día que queda para no pasarte. */
  perDay: number
  /** Lo que "tocaría" haber gastado hoy a ritmo lineal. */
  paceAllowed: number
  /** Fracción gastada del límite (puede superar 1). */
  pct: number
  state: BudgetState
}

/**
 * Estado del límite mensual. `day` es el día de hoy dentro del mes (ver
 * dayCursor) y `days` los días del mes.
 */
export function budgetStatus(spent: number, limit: number, day: number, days: number): BudgetStatus {
  const remaining = Math.max(0, round2(limit - spent))
  const exceeded = Math.max(0, round2(spent - limit))
  const daysLeft = Math.max(0, days - day)
  const perDay = daysLeft > 0 ? round2(remaining / daysLeft) : remaining
  const paceAllowed = round2((limit * day) / days)
  const pct = limit > 0 ? round2(spent / limit) : 0
  const state: BudgetState = spent > limit + 0.005 ? 'exceeded' : spent > paceAllowed + 0.005 ? 'over_pace' : 'under'
  return { spent: round2(spent), limit, remaining, exceeded, daysLeft, perDay, paceAllowed, pct, state }
}

// ------------------------------------------------------------
// Huchas: plan mensual y proyección
// ------------------------------------------------------------

/** Suma n meses a un YYYY-MM. */
export function addMonths(yyyymm: string, n: number): string {
  const [y, m] = yyyymm.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Meses enteros que quedan desde el mes de hoy hasta el mes de la fecha (mínimo 1 si la fecha no ha pasado). */
export function monthsUntil(deadlineIso: string, today: string = todayIso()): number {
  const [y1, m1] = monthOf(today).split('-').map(Number)
  const [y2, m2] = monthOf(deadlineIso).split('-').map(Number)
  const diff = (y2 - y1) * 12 + (m2 - m1)
  if (deadlineIso < today) return 0
  return Math.max(1, diff)
}

/** Cuánto habría que poner cada mes para llegar al objetivo a tiempo. */
export function monthlyPlan(remaining: number, monthsLeft: number): number {
  if (remaining <= 0) return 0
  return round2(remaining / Math.max(1, monthsLeft))
}

export interface Movement {
  contributed_on: string
  amount: number
  direction: 'in' | 'out'
}

/** Neto (entradas − salidas) por mes. */
export function netByMonth(moves: Movement[], months: string[]): number[] {
  const map = new Map<string, number>()
  for (const mv of moves) {
    const k = monthOf(mv.contributed_on)
    const v = mv.direction === 'out' ? -Number(mv.amount) : Number(mv.amount)
    map.set(k, round2((map.get(k) ?? 0) + v))
  }
  return months.map((m) => map.get(m) ?? 0)
}

/** Saldo de una hucha: entradas − salidas. */
export function goalBalance(moves: Movement[]): number {
  return round2(moves.reduce((a, mv) => a + (mv.direction === 'out' ? -Number(mv.amount) : Number(mv.amount)), 0))
}

/**
 * Mes en el que se llegaría al objetivo al ritmo medio de los últimos 3 meses.
 * Solo cuentan los meses desde que existe la hucha (sinceMonth): los meses
 * anteriores, vacíos por definición, no bajan la media.
 * Devuelve null si el ritmo es cero o negativo.
 */
export function projectedMonth(remaining: number, moves: Movement[], today: string = todayIso(), sinceMonth?: string): string | null {
  if (remaining <= 0) return monthOf(today)
  const cur = monthOf(today)
  const window = lastMonths(cur, 3).filter((m) => !sinceMonth || m >= sinceMonth)
  if (window.length === 0) return null
  const net = netByMonth(moves, window)
  const rate = net.reduce((a, b) => a + b, 0) / window.length
  if (rate <= 0) return null
  return addMonths(cur, Math.ceil(remaining / rate))
}
