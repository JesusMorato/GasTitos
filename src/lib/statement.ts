// Importar gastos desde un extracto bancario (CSV o Excel ya convertido a filas).
// Todo puro y testeado (statement.spec.ts): aquí no hay Vue ni Supabase.
//
// Pasos: 1) partir el texto en filas (parseDelimited), 2) adivinar qué columna es la
// fecha, el concepto y el importe (detectLayout), 3) quedarse solo con los cargos
// (parseStatement). Después, para cada cargo, proponer tipo y categoría a partir de
// los gastos ya apuntados con un concepto parecido (suggestFromHistory) y avisar si
// parece que ya está apuntado (alreadyRecorded).
import { round2 } from './money'
import { normalize } from './search'

/** Un cargo del extracto, ya limpio. El importe es siempre positivo. */
export interface StatementItem {
  /** Posición en el archivo (para distinguir dos cargos iguales). */
  key: number
  /** AAAA-MM-DD */
  date: string
  concept: string
  amount: number
}

export interface ParsedStatement {
  items: StatementItem[]
  /** Ingresos (abonos) que se han dejado fuera. */
  incomes: number
  /** Filas que no se han entendido (sin fecha o sin importe). */
  skipped: number
}

export interface Layout {
  /** Fila donde empiezan los datos. */
  firstRow: number
  date: number
  concept: number
  /** Columna con el importe (negativo = cargo), o -1 si hay columnas separadas. */
  amount: number
  /** Columna de cargos y de abonos, cuando el banco las separa. */
  debit: number
  credit: number
}

// ---------- 1. Texto → filas ----------

/** Parte un CSV en filas y celdas. Adivina el separador (; , o tabulador) y respeta las comillas. */
export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const sep = detectSeparator(clean)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === sep) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''))
}

function detectSeparator(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20)
  let best = ';'
  let bestScore = -1
  for (const sep of [';', ',', '\t', '|']) {
    const counts = sample.map((l) => l.split(sep).length - 1)
    const withSep = counts.filter((c) => c > 0).length
    // Cuantas más líneas lo tengan y más veces por línea, mejor.
    const score = withSep * 100 + Math.min(...counts.map((c) => (c > 0 ? c : 99)))
    if (withSep > 0 && score > bestScore) { bestScore = score; best = sep }
  }
  return best
}

// ---------- 2. Celdas sueltas ----------

/** "1.234,56 €", "-12,34", "(12.50)", "−8" → número (null si no es un importe). */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/ /g, ' ').trim()
  if (!s) return null
  let negative = false
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1) }
  s = s.replace(/[€$£]|eur|usd/gi, '').replace(/\s+/g, '')
  if (/^[-−–]/.test(s)) { negative = !negative; s = s.slice(1) }
  else if (/^\+/.test(s)) s = s.slice(1)
  if (/[-−–]$/.test(s)) { negative = !negative; s = s.slice(0, -1) }
  if (!/^\d[\d.,]*$/.test(s)) return null
  const hasComma = s.includes(',')
  const hasDot = s.includes('.')
  if (hasComma && hasDot) {
    // El último separador es el decimal; el otro, de miles.
    const decimal = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'
    s = s.split(decimal === ',' ? '.' : ',').join('').replace(decimal, '.')
  } else if (hasComma || hasDot) {
    const sepChar = hasComma ? ',' : '.'
    const parts = s.split(sepChar)
    // Varias veces, o una sola seguida de 3 cifras: separador de miles ("1.234"). Si no, decimal.
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) s = parts.join('')
    else s = parts.join('.')
  }
  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return round2(negative ? -n : n)
}

/** "19/10/2026", "19-10-26", "2026-10-19T10:00", o un número de serie de Excel → AAAA-MM-DD. */
export function parseDate(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/)
  if (m) return valid(+m[1], +m[2], +m[3])
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:\s|$)/)
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3]
    return valid(y, +m[2], +m[1])
  }
  if (/^\d{5}$/.test(s)) return excelSerialToIso(+s)
  return null
}

function valid(y: number, mo: number, d: number): string | null {
  if (y < 1990 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCMonth() !== mo - 1) return null
  return dt.toISOString().slice(0, 10)
}

/** Excel guarda las fechas como días desde el 30/12/1899. */
export function excelSerialToIso(serial: number): string | null {
  if (serial < 30000 || serial > 80000) return null
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10)
}

// ---------- 3. Qué columna es cada cosa ----------

const DATE_NAMES = ['fecha operacion', 'fecha de operacion', 'f. operativa', 'fecha contable', 'completed date', 'fecha', 'date', 'data']
const DATE_WEAK = ['fecha valor', 'f. valor', 'started date']
const CONCEPT_NAMES = ['concepto', 'descripcion', 'description', 'detalle', 'movimiento', 'comercio', 'merchant', 'beneficiario', 'observaciones', 'nombre']
const AMOUNT_NAMES = ['importe', 'amount', 'cantidad', 'monto', 'valor']
const DEBIT_NAMES = ['cargo', 'debe', 'debito', 'adeudo', 'gasto', 'salida', 'paid out', 'money out', 'debit', 'withdrawal']
const CREDIT_NAMES = ['abono', 'haber', 'credito', 'ingreso', 'entrada', 'paid in', 'money in', 'credit', 'deposit']
const NOT_AMOUNT = ['saldo', 'balance', 'fee', 'comision', 'tipo de cambio', 'fecha', 'date']

function findCol(cells: string[], names: string[], exclude: string[] = []): number {
  const norm = cells.map((c) => normalize(c))
  for (const name of names) {
    const i = norm.findIndex((c) => c.includes(name) && !exclude.some((x) => c.includes(x)))
    if (i >= 0) return i
  }
  return -1
}

/** Busca una fila de cabecera; si no la hay, deduce las columnas mirando el contenido. */
export function detectLayout(rows: string[][]): Layout | null {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const cells = rows[r]
    let date = findCol(cells, DATE_NAMES)
    if (date < 0) date = findCol(cells, DATE_WEAK)
    if (date < 0) continue
    const amount = findCol(cells, AMOUNT_NAMES, NOT_AMOUNT)
    const debit = findCol(cells, DEBIT_NAMES, NOT_AMOUNT)
    const credit = findCol(cells, CREDIT_NAMES, NOT_AMOUNT)
    if (amount < 0 && debit < 0) continue
    let concept = findCol(cells, CONCEPT_NAMES)
    if (concept < 0) concept = longestTextColumn(rows.slice(r + 1), [date, amount, debit, credit])
    return { firstRow: r + 1, date, concept, amount: debit >= 0 ? -1 : amount, debit, credit }
  }
  return guessLayout(rows)
}

function guessLayout(rows: string[][]): Layout | null {
  const width = Math.max(0, ...rows.map((r) => r.length))
  if (!width) return null
  const n = rows.length
  const dateHits = Array.from({ length: width }, (_, c) => rows.filter((r) => parseDate(r[c] ?? '')).length)
  const date = dateHits.indexOf(Math.max(...dateHits))
  if (dateHits[date] < Math.max(1, n * 0.5)) return null
  const numeric: number[] = []
  for (let c = 0; c < width; c++) {
    if (c === date) continue
    const hits = rows.filter((r) => parseAmount(r[c] ?? '') != null).length
    if (hits >= n * 0.6) numeric.push(c)
  }
  if (!numeric.length) return null
  // Entre las columnas numéricas, la que más negativos tenga suele ser el importe (el saldo casi nunca es negativo).
  const negatives = numeric.map((c) => rows.filter((r) => (parseAmount(r[c] ?? '') ?? 0) < 0).length)
  const amount = numeric[negatives.indexOf(Math.max(...negatives))]
  const concept = longestTextColumn(rows, [date, amount])
  return { firstRow: 0, date, concept, amount, debit: -1, credit: -1 }
}

function longestTextColumn(rows: string[][], exclude: number[]): number {
  const width = Math.max(0, ...rows.map((r) => r.length))
  let best = -1
  let bestLen = 0
  for (let c = 0; c < width; c++) {
    if (exclude.includes(c)) continue
    const texts = rows.map((r) => r[c] ?? '').filter((v) => v && parseAmount(v) == null && !parseDate(v))
    const len = texts.reduce((a, t) => a + t.length, 0)
    if (len > bestLen) { bestLen = len; best = c }
  }
  return best
}

// ---------- 4. Filas → cargos ----------

export function parseStatement(rows: string[][], layout: Layout | null = detectLayout(rows)): ParsedStatement | null {
  if (!layout) return null
  const data = rows.slice(layout.firstRow)
  const items: StatementItem[] = []
  let incomes = 0
  let skipped = 0
  // Si el banco exporta todos los importes en positivo (sin ningún negativo), se toman todos como cargos.
  const anyNegative = layout.amount >= 0 && data.some((r) => (parseAmount(r[layout.amount] ?? '') ?? 0) < 0)
  data.forEach((r, i) => {
    const date = parseDate(r[layout.date] ?? '')
    if (!date) { skipped++; return }
    let charge: number | null = null
    if (layout.amount >= 0) {
      const v = parseAmount(r[layout.amount] ?? '')
      if (v == null || v === 0) { skipped++; return }
      if (anyNegative && v > 0) { incomes++; return }
      charge = Math.abs(v)
    } else {
      const d = parseAmount(r[layout.debit] ?? '')
      const c = layout.credit >= 0 ? parseAmount(r[layout.credit] ?? '') : null
      if (d != null && d !== 0) charge = Math.abs(d)
      else if (c != null && c !== 0) { incomes++; return }
      else { skipped++; return }
    }
    const concept = cleanConcept(r[layout.concept] ?? '')
    items.push({ key: i, date, concept, amount: round2(charge) })
  })
  // Del más reciente al más antiguo, como las listas de la app.
  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.key - b.key))
  return { items, incomes, skipped }
}

const PREFIXES = [
  /^compra (en|tarj\.?|tarjeta|con tarjeta( en)?)\s+/i,
  /^pago (movil|móvil|con tarjeta|tarjeta)( en)?\s+/i,
  /^pago en\s+/i,
  /^(recibo|adeudo|cargo|domiciliacion|domiciliación)( de| por)?\s+/i,
  /^transferencia( inmediata)?( realizada)?( a favor de| a)?\s+/i,
  /^bizum a\s+/i,
  /^tarjeta\s+\*?\d{2,}\s+/i,
]

/** Quita la paja típica de los bancos ("COMPRA EN", números de tarjeta) y pasa las mayúsculas a normal. */
export function cleanConcept(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim()
  for (const re of PREFIXES) s = s.replace(re, '')
  s = s.replace(/\b\d{4}\*+\d{2,4}\b|\*{2,}\d{2,4}\b/g, '').replace(/\s+/g, ' ').replace(/[,.\s]+$/, '').trim()
  if (s && s === s.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(s)) {
    s = s.toLowerCase().replace(/(^|[\s(/-])(\p{L})/gu, (_, pre: string, ch: string) => pre + ch.toUpperCase())
  }
  return s || raw.trim()
}

// ---------- 5. Cruzar con lo ya apuntado ----------

export interface HistoryExpense {
  spent_on: string
  amount: number
  category_id: string
  description: string | null
  is_shared: boolean
  funding: 'personal' | 'pot'
  split_mode: string
}

export interface Suggestion {
  category_id: string
  kind: 'personal' | 'shared' | 'pot'
  split_mode: string
}

/** Gasto más reciente con un concepto igual o parecido: su categoría y tipo. */
export function suggestFromHistory(concept: string, history: HistoryExpense[]): Suggestion | null {
  const c = normalize(concept)
  if (c.length < 3) return null
  const sorted = [...history].filter((e) => e.description).sort((a, b) => (a.spent_on < b.spent_on ? 1 : -1))
  const exact = sorted.find((e) => normalize(e.description!) === c)
  const similar = exact ?? sorted.find((e) => {
    const d = normalize(e.description!)
    return d.length >= 4 && (d.includes(c) || c.includes(d))
  })
  if (!similar) return null
  return {
    category_id: similar.category_id,
    kind: !similar.is_shared ? 'personal' : similar.funding === 'pot' ? 'pot' : 'shared',
    split_mode: similar.split_mode,
  }
}

/** Ya hay un gasto apuntado con la misma fecha y el mismo importe. */
export function alreadyRecorded(item: Pick<StatementItem, 'date' | 'amount'>, history: Array<Pick<HistoryExpense, 'spent_on' | 'amount'>>): boolean {
  return history.some((e) => e.spent_on === item.date && round2(e.amount) === item.amount)
}

/** Decodifica el texto de un archivo: UTF-8 y, si sale con caracteres rotos, Windows-1252 (Excel antiguo). */
export function decodeText(buf: ArrayBuffer): string {
  const utf8 = new TextDecoder('utf-8').decode(buf)
  if (!utf8.includes('�')) return utf8
  try {
    return new TextDecoder('windows-1252').decode(buf)
  } catch {
    return utf8
  }
}
