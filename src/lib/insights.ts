// El cerdito: consejos y comparaciones calculados con reglas a partir de "lo mío"
// (personal + mi parte de repartidos + mi % de la cuenta conjunta). No es una IA:
// todo son cuentas sobre los datos, así que las cifras siempre cuadran.
// Puro y testeado (insights.spec.ts). Los textos marcan en **negrita** las cifras.
import {
  addMonths, budgetStatus, dayCursor, daysInMonth, formatEur, formatMonth, lastMonths,
  monthOf, monthlyPlan, monthsUntil, round2, sum, type Share,
} from './money'

/** Un gasto tal y como cuenta para mí. */
export interface MyItem {
  id: string
  spent_on: string
  amount: number
  category_id: string
  /** Viene de un gasto fijo. */
  fixed: boolean
  description: string | null
  /** De dónde sale `amount`: gasto personal entero, mi parte de un repartido o mi % de la conjunta. */
  origin: 'personal' | 'shared' | 'pot'
  /** Importe completo del gasto original (igual a `amount` en los personales). */
  full_amount: number
}

export interface RowForMe {
  id?: string
  user_id: string
  amount: number
  spent_on: string
  category_id: string
  description?: string | null
  is_shared: boolean
  funding: 'personal' | 'pot'
  recurring_id: string | null
  shares: Share[]
}

/** "Lo mío": gasto personal entero, mi parte de los repartidos y mi % de la conjunta. */
export function myItems(rows: RowForMe[], userId: string, myPct: number): MyItem[] {
  const out: MyItem[] = []
  for (const e of rows) {
    const base = {
      id: e.id ?? '', spent_on: e.spent_on, category_id: e.category_id, fixed: !!e.recurring_id,
      description: e.description ?? null, full_amount: e.amount,
    }
    if (!e.is_shared) {
      if (e.user_id === userId) out.push({ ...base, origin: 'personal', amount: e.amount })
    } else if (e.funding === 'pot') {
      out.push({ ...base, origin: 'pot', amount: round2(e.amount * myPct) })
    } else {
      const mine = e.shares.find((s) => s.user_id === userId)?.amount ?? 0
      if (mine > 0) out.push({ ...base, origin: 'shared', amount: mine })
    }
  }
  return out
}

export type Topic = 'mes' | 'categorias' | 'ahorro'
export type Tone = 'good' | 'warn' | 'info'

export interface Insight {
  id: string
  topic: Topic
  tone: Tone
  /** Merece el puntito de aviso en el botón. */
  important: boolean
  text: string
}

export interface InsightInput {
  items: MyItem[]
  today: string
  categoryName: (id: string) => string
  /** Mi límite mensual, o null si no tengo. */
  limit: number | null
  /** Gastos fijos personales activos, en euros al mes (los variables no cuentan). */
  fixedMonthly: number
  goals: Array<{ name: string; target: number | null; saved: number; deadline: string | null }>
}

// Umbrales: por debajo de esto, la diferencia no merece comentario.
const MIN_DIFF = 25
const MIN_PCT = 0.3
const BIG_DIFF = 50

const eur = (n: number) => `**${formatEur(n)}**`

function pct(n: number): string {
  return `${Math.round(n * 100)} %`
}

function byCategory(items: MyItem[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) m.set(it.category_id, round2((m.get(it.category_id) ?? 0) + it.amount))
  return m
}

/** Gastos de un mes hasta el día `day` incluido (o el mes entero si es más corto). */
function upToDay(items: MyItem[], month: string, day: number): MyItem[] {
  const last = Math.min(day, daysInMonth(month))
  return items.filter((x) => monthOf(x.spent_on) === month && Number(x.spent_on.slice(8, 10)) <= last)
}

function listJoin(parts: string[]): string {
  if (parts.length <= 1) return parts.join('')
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`
}

export function computeInsights(input: InsightInput): Insight[] {
  const { items, today, categoryName, limit } = input
  const month = monthOf(today)
  const prev = addMonths(month, -1)
  const day = dayCursor(month, today)
  const days = daysInMonth(month)
  const out: Insight[] = []

  const nowItems = upToDay(items, month, day)
  const prevItems = upToDay(items, prev, day)
  const totalNow = round2(sum(nowItems.map((x) => x.amount)))
  const totalPrev = round2(sum(prevItems.map((x) => x.amount)))
  const hasHistory = items.some((x) => monthOf(x.spent_on) < month)

  // ---------------- ¿Cómo voy este mes? ----------------
  if (nowItems.length === 0) {
    out.push({ id: 'mes-vacio', topic: 'mes', tone: 'info', important: false, text: `Aún no hay gastos en ${formatMonth(month)}.` })
  } else if (totalPrev > 0) {
    const diff = round2(totalNow - totalPrev)
    const rel = diff / totalPrev
    if (diff >= MIN_DIFF && rel >= 0.2) {
      out.push({ id: 'mes-sube', topic: 'mes', tone: 'warn', important: diff >= BIG_DIFF,
        text: `Llevas ${eur(totalNow)} este mes: ${eur(diff)} más que el mes pasado a estas alturas (${formatEur(totalPrev)}).` })
    } else if (-diff >= MIN_DIFF && -rel >= 0.15) {
      out.push({ id: 'mes-baja', topic: 'mes', tone: 'good', important: false,
        text: `Llevas ${eur(totalNow)} este mes: ${eur(-diff)} menos que el mes pasado a estas alturas. ¡Bien!` })
    } else {
      out.push({ id: 'mes-igual', topic: 'mes', tone: 'info', important: false,
        text: `Llevas ${eur(totalNow)} este mes, parecido al mes pasado a estas alturas (${formatEur(totalPrev)}).` })
    }
  } else {
    out.push({ id: 'mes-total', topic: 'mes', tone: 'info', important: false, text: `Llevas ${eur(totalNow)} gastados este mes.` })
  }

  if (limit && limit > 0) {
    const st = budgetStatus(totalNow, limit, day, days)
    if (st.state === 'exceeded') {
      out.push({ id: 'limite-superado', topic: 'mes', tone: 'warn', important: true,
        text: `Te has pasado de tu límite de ${formatEur(limit)} en ${eur(st.exceeded)}.` })
    } else if (st.state === 'over_pace') {
      out.push({ id: 'limite-ritmo', topic: 'mes', tone: 'warn', important: true,
        text: `Vas por encima del ritmo de tu límite: te quedan ${eur(st.remaining)} para ${st.daysLeft} días (${eur(st.perDay)} al día).` })
    } else if (st.daysLeft > 0) {
      out.push({ id: 'limite-bien', topic: 'mes', tone: 'good', important: false,
        text: `Vas bien con tu límite: te quedan ${eur(st.remaining)} para ${st.daysLeft} días (${formatEur(st.perDay)} al día).` })
    }
  }

  // ---------------- ¿En qué gasto más? ----------------
  const catNow = byCategory(nowItems)
  const catPrev = byCategory(prevItems)
  const top = [...catNow.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (top.length) {
    out.push({ id: 'cat-top', topic: 'categorias', tone: 'info', important: false,
      text: `Donde más gastas este mes: ${listJoin(top.map(([id, v]) => `${categoryName(id)} (${formatEur(v)})`))}.` })
  } else {
    out.push({ id: 'cat-vacio', topic: 'categorias', tone: 'info', important: false, text: 'Cuando apuntes gastos este mes te diré en qué se va el dinero.' })
  }

  const ups: Array<{ id: string; now: number; prev: number; diff: number }> = []
  const downs: Array<{ id: string; now: number; prev: number; diff: number }> = []
  for (const id of new Set([...catNow.keys(), ...catPrev.keys()])) {
    const n = catNow.get(id) ?? 0
    const p = catPrev.get(id) ?? 0
    const diff = round2(n - p)
    if (diff >= MIN_DIFF && (p === 0 ? hasHistory && n >= BIG_DIFF : diff / p >= MIN_PCT)) ups.push({ id, now: n, prev: p, diff })
    if (-diff >= MIN_DIFF && p > 0 && -diff / p >= MIN_PCT) downs.push({ id, now: n, prev: p, diff })
  }
  for (const u of ups.sort((a, b) => b.diff - a.diff).slice(0, 3)) {
    out.push({ id: `cat-sube:${u.id}`, topic: 'categorias', tone: 'warn', important: u.diff >= BIG_DIFF,
      text: u.prev === 0
        ? `En **${categoryName(u.id)}** llevas ${eur(u.now)}, y el mes pasado a estas alturas no habías gastado nada.`
        : `En **${categoryName(u.id)}** llevas ${eur(u.now)}: ${eur(u.diff)} más que el mes pasado a estas alturas (${formatEur(u.prev)}).` })
  }
  for (const d of downs.sort((a, b) => a.diff - b.diff).slice(0, 2)) {
    out.push({ id: `cat-baja:${d.id}`, topic: 'categorias', tone: 'good', important: false,
      text: `En **${categoryName(d.id)}** llevas ${eur(-d.diff)} menos que el mes pasado a estas alturas. ¡Bien hecho!` })
  }

  // ---------------- ¿Dónde puedo ahorrar? ----------------
  // Media de los 3 meses anteriores, contando solo meses con gastos.
  const window = lastMonths(prev, 3).filter((m) => items.some((x) => monthOf(x.spent_on) === m))
  if (window.length) {
    const past = items.filter((x) => window.includes(monthOf(x.spent_on)))
    const avgMonth = round2(sum(past.map((x) => x.amount)) / window.length)
    const variable = byCategory(past.filter((x) => !x.fixed))
    const biggest = [...variable.entries()].sort((a, b) => b[1] - a[1])[0]
    if (biggest && biggest[1] / window.length >= 30) {
      const avg = round2(biggest[1] / window.length)
      out.push({ id: `ahorro-recorte:${biggest[0]}`, topic: 'ahorro', tone: 'info', important: false,
        text: `Tu mayor gasto que no es fijo es **${categoryName(biggest[0])}**: ${formatEur(avg)} al mes de media. Recortando un 10 % ahorrarías ${eur(round2(avg * 0.1 * 12))} al año.` })
    }
    if (input.fixedMonthly > 0 && avgMonth > 0) {
      out.push({ id: 'ahorro-fijos', topic: 'ahorro', tone: 'info', important: false,
        text: `Tus gastos fijos personales suman ${eur(input.fixedMonthly)} al mes (${pct(Math.min(1, input.fixedMonthly / avgMonth))} de lo que gastas de media). Revisa si sobra alguna suscripción.` })
    }
  }

  for (const g of input.goals) {
    if (!g.target || g.target <= 0) continue
    const remaining = round2(g.target - g.saved)
    if (remaining <= 0) {
      out.push({ id: `hucha-ok:${g.name}`, topic: 'ahorro', tone: 'good', important: true, text: `¡Ya has llegado al objetivo de la hucha **${g.name}**! Puedes gastarlo o subir el objetivo.` })
    } else if (g.deadline) {
      const months = monthsUntil(g.deadline, today)
      if (months === 0) {
        out.push({ id: `hucha-vencida:${g.name}`, topic: 'ahorro', tone: 'warn', important: true,
          text: `La hucha **${g.name}** vencía en ${formatMonth(monthOf(g.deadline))} y aún faltan ${formatEur(remaining)}. Cambia la fecha o el objetivo.` })
        continue
      }
      out.push({ id: `hucha-plan:${g.name}`, topic: 'ahorro', tone: 'info', important: false,
        text: `Para la hucha **${g.name}** te faltan ${formatEur(remaining)}: ${eur(monthlyPlan(remaining, months))} al mes hasta ${formatMonth(monthOf(g.deadline))}.` })
    }
  }

  if (!limit) {
    out.push({ id: 'ahorro-limite', topic: 'ahorro', tone: 'info', important: false,
      text: 'No tienes límite mensual. Ponerte uno (en la tarjeta "Mi límite del mes") te ayuda a ver si vas rápido.' })
  }
  if (!out.some((i) => i.topic === 'ahorro' && i.id !== 'ahorro-limite')) {
    out.push({ id: 'ahorro-pocos-datos', topic: 'ahorro', tone: 'info', important: false,
      text: 'Aún tengo pocos datos. Con un par de meses de gastos apuntados te daré ideas concretas.' })
  }

  return out
}

/**
 * Huella de los avisos importantes del mes. El botón enseña el puntito si es
 * distinta de la última que se vio; vacía si no hay nada importante.
 */
export function insightsSignature(insights: Insight[], today: string): string {
  const ids = insights.filter((i) => i.important).map((i) => i.id).sort()
  return ids.length ? `${monthOf(today)}|${ids.join(',')}` : ''
}

/** Trocea "texto **negrita** texto" para pintarlo sin v-html. */
export function boldParts(text: string): Array<{ text: string; bold: boolean }> {
  return text.split('**').map((t, i) => ({ text: t, bold: i % 2 === 1 })).filter((p) => p.text !== '')
}
