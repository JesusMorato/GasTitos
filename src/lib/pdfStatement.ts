// Importar un extracto en PDF (Bankinter y otros bancos que solo dan PDF).
//
// 1) pdfToLines: el PDF se lee con pdf.js (Mozilla) en el propio navegador y se sacan
//    las líneas de texto, agrupando los trozos que están a la misma altura.
// 2) linesToTable (puro, testeado): de cada línea que empieza por una fecha se sacan el
//    concepto y los importes del final. Si hay columna de saldo, el signo del movimiento
//    sale de cómo cambia el saldo (los PDF muchas veces no ponen el signo). El resultado
//    es una tabla Fecha / Concepto / Importe que entiende parseStatement.
import { parseAmount, parseDate, type Layout } from './statement'

/** Trozo de texto del PDF con su posición (lo que da pdf.js). */
export interface TextPiece {
  str: string
  x: number
  y: number
}

/** Agrupa los trozos de una página en líneas (misma altura), de arriba abajo y de izquierda a derecha. */
export function groupLines(pieces: TextPiece[], tolerance = 2.5): string[] {
  const sorted = [...pieces].filter((p) => p.str.trim() !== '').sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: Array<{ y: number; parts: TextPiece[] }> = []
  for (const p of sorted) {
    const last = lines[lines.length - 1]
    if (last && Math.abs(last.y - p.y) <= tolerance) last.parts.push(p)
    else lines.push({ y: p.y, parts: [p] })
  }
  return lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.str).join(' ').replace(/\s+/g, ' ').trim())
}

const AMOUNT = /^[-+−–]?(?:\d{1,3}(?:\.\d{3})+,\d{2}|\d+[.,]\d{2}|\d{1,3}(?:,\d{3})+\.\d{2})[-]?$/

function isAmountToken(t: string): boolean {
  return AMOUNT.test(t.replace(/€|EUR/gi, '').trim())
}

interface Movement {
  date: string
  concept: string
  amount: number
  balance: number | null
  /** Línea tipo "Saldo anterior": solo sirve para encadenar saldos, no es un movimiento. */
  balanceOnly?: boolean
}

/**
 * Líneas de texto → tabla con cabecera [Fecha, Concepto, Importe]. Devuelve null si no
 * parece un extracto (ninguna línea con fecha e importe).
 */
export function linesToTable(lines: string[]): string[][] | null {
  const moves: Movement[] = []
  for (const raw of lines) {
    const tokens = raw.split(/\s+/).filter((t) => t && !/^(€|EUR)$/i.test(t))
    if (tokens.length < 2) continue
    const date = parseDate(tokens[0])
    if (!date) continue
    let i = 1
    // Puede haber una segunda fecha (fecha valor) pegada a la primera.
    while (i < tokens.length && parseDate(tokens[i])) i++
    // Importes al final de la línea (como mucho dos: movimiento y saldo).
    const amounts: number[] = []
    let j = tokens.length - 1
    while (j >= i && amounts.length < 2 && isAmountToken(tokens[j])) {
      const v = parseAmount(tokens[j].replace(/€|EUR/gi, ''))
      if (v == null) break
      amounts.unshift(v)
      j--
    }
    if (!amounts.length) continue
    // A veces la fecha valor va justo antes de los importes.
    while (j >= i && parseDate(tokens[j])) j--
    const concept = tokens.slice(i, j + 1).join(' ')
    if (!concept) continue
    if (amounts.length === 1 && /saldo/i.test(concept)) {
      moves.push({ date, concept, amount: 0, balance: amounts[0], balanceOnly: true })
      continue
    }
    moves.push({ date, concept, amount: amounts[0], balance: amounts.length === 2 ? amounts[1] : null })
  }
  const real = moves.filter((m) => !m.balanceOnly)
  if (!real.length) return null
  applyBalanceSigns(moves)
  return [['Fecha', 'Concepto', 'Importe'], ...real.map((m) => [m.date, m.concept, formatSigned(m.amount)])]
}

/**
 * Con columna de saldo, el signo de cada movimiento es el del cambio de saldo respecto a
 * la fila anterior. Se prueba en los dos sentidos (extracto de más antiguo a más nuevo o
 * al revés) y se usa el que cuadre en más filas; si no cuadra ninguno, se deja el signo
 * que traía (o ninguno).
 */
function applyBalanceSigns(moves: Movement[]) {
  const withBalance = moves.filter((m) => m.balance != null)
  if (withBalance.length < 2) return
  const eq = (a: number, b: number) => Math.abs(a - b) < 0.011
  // ascendente: saldo[i] = saldo[i-1] ± importe[i]; descendente: saldo[i-1] = saldo[i] ± importe[i-1]
  let asc = 0
  let desc = 0
  for (let i = 1; i < withBalance.length; i++) {
    const prev = withBalance[i - 1]
    const cur = withBalance[i]
    if (eq(Math.abs(cur.balance! - prev.balance!), Math.abs(cur.amount))) asc++
    if (eq(Math.abs(prev.balance! - cur.balance!), Math.abs(prev.amount))) desc++
  }
  const needed = Math.max(1, Math.floor((withBalance.length - 1) * 0.6))
  if (Math.max(asc, desc) < needed) return
  const ascending = asc >= desc
  for (let i = 0; i < withBalance.length; i++) {
    const cur = withBalance[i]
    if (cur.balanceOnly) continue
    // La fila con la que se compara: la anterior en el tiempo (justo antes o justo después, según el orden).
    const other = ascending ? withBalance[i - 1] : withBalance[i + 1]
    if (!other) continue
    const delta = cur.balance! - other.balance!
    if (eq(Math.abs(delta), Math.abs(cur.amount))) cur.amount = delta < 0 ? -Math.abs(cur.amount) : Math.abs(cur.amount)
  }
}

function formatSigned(n: number): string {
  return n.toFixed(2).replace('.', ',')
}

/** Columnas fijas de la tabla que devuelve linesToTable. */
export const PDF_LAYOUT: Layout = { firstRow: 1, date: 0, concept: 1, amount: 2, debit: -1, credit: -1 }

/** Error de pdf.js cuando el PDF pide contraseña (code 1) o la dada es incorrecta (code 2). */
export function passwordProblem(e: unknown): 'needed' | 'wrong' | null {
  const err = e as { name?: string; code?: number }
  if (err?.name !== 'PasswordException') return null
  return err.code === 2 ? 'wrong' : 'needed'
}

/** Lee el PDF con pdf.js y devuelve sus líneas de texto, página tras página. */
export async function pdfToLines(buf: ArrayBuffer, password?: string): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  if (typeof document !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
    const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), password, verbosity: 0 })
  const lines: string[] = []
  try {
    const doc = await task.promise
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n)
      const content = await page.getTextContent()
      const pieces: TextPiece[] = []
      for (const it of content.items) {
        if ('str' in it && it.transform) pieces.push({ str: it.str, x: it.transform[4], y: it.transform[5] })
      }
      lines.push(...groupLines(pieces))
    }
  } finally {
    await task.destroy()
  }
  return lines
}
