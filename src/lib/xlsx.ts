// Lector mínimo de archivos Excel (.xlsx) sin librerías: un .xlsx es un zip con XML
// dentro. Se descomprime con DecompressionStream (lo traen todos los navegadores
// actuales) y se saca la primera hoja como filas de texto. Las fechas salen como
// AAAA-MM-DD y los números con punto decimal y dos cifras ("12.50"), que es lo que
// entiende parseAmount en statement.ts.
//
// Solo .xlsx: el .xls antiguo (binario) no se puede leer aquí.

/** Devuelve las filas de la primera hoja, cada celda como texto. */
export async function readXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const entries = await unzip(buf)
  const name = sheetName(Object.keys(entries))
  if (!name) throw new Error('El archivo no parece un Excel (.xlsx)')
  const shared = parseSharedStrings(entries['xl/sharedStrings.xml'] ? await text(entries['xl/sharedStrings.xml']) : '')
  const dateStyles = entries['xl/styles.xml'] ? parseDateStyles(await text(entries['xl/styles.xml'])) : new Set<number>()
  return parseSheet(await text(entries[name]), shared, dateStyles)
}

function sheetName(names: string[]): string | null {
  const sheets = names.filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
  sheets.sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
  return sheets[0] ?? null
}

async function text(bytes: Uint8Array): Promise<string> {
  return new TextDecoder('utf-8').decode(bytes)
}

// ---------- zip ----------

async function unzip(buf: ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const view = new DataView(buf)
  const bytes = new Uint8Array(buf)
  // El directorio central está al final del archivo; se busca su firma desde atrás.
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 70000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('El archivo no es un .xlsx válido')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const out: Record<string, Uint8Array> = {}
  for (let k = 0; k < count; k++) {
    if (view.getUint32(p, true) !== 0x02014b50) break
    const method = view.getUint16(p + 10, true)
    const compressed = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const local = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    const dataStart = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true)
    const data = bytes.subarray(dataStart, dataStart + compressed)
    if (name.endsWith('.xml') || name.endsWith('.rels')) {
      out[name] = method === 0 ? data : await inflate(data)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body!.pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ---------- xml ----------

function decodeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? m[1] : null
}

function innerTexts(xml: string): string {
  return Array.from(xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g), (m) => decodeXml(m[1])).join('')
}

export function parseSharedStrings(xml: string): string[] {
  return Array.from(xml.matchAll(/<si>([\s\S]*?)<\/si>/g), (m) => innerTexts(m[1]))
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 45, 46, 47])

/** Índices de estilo (atributo s de la celda) cuyo formato numérico es de fecha. */
export function parseDateStyles(xml: string): Set<number> {
  const custom = new Set<number>()
  for (const m of xml.matchAll(/<numFmt\s[^>]*\/?>/g)) {
    const id = Number(attr(m[0], 'numFmtId'))
    const code = decodeXml(attr(m[0], 'formatCode') ?? '')
    // Quita lo que va entre corchetes/comillas; si quedan "d" o "y" y no hay ceros/almohadillas, es fecha.
    const bare = code.replace(/\[[^\]]*\]|"[^"]*"|\\./g, '')
    if (/[dy]/i.test(bare) && !/[#0]/.test(bare)) custom.add(id)
  }
  const out = new Set<number>()
  const xfs = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)
  if (!xfs) return out
  Array.from(xfs[1].matchAll(/<xf\s[^>]*\/?>/g)).forEach((m, i) => {
    const id = Number(attr(m[0], 'numFmtId') ?? '0')
    if (BUILTIN_DATE_FORMATS.has(id) || custom.has(id)) out.add(i)
  })
  return out
}

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function serialToIso(serial: number): string {
  return new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000).toISOString().slice(0, 10)
}

export function parseSheet(xml: string, shared: string[], dateStyles: Set<number>): string[][] {
  const rows: string[][] = []
  for (const rowMatch of xml.matchAll(/<row(?:\s[^>]*)?>([\s\S]*?)<\/row>/g)) {
    const row: string[] = []
    for (const c of rowMatch[1].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const tag = `<c ${c[1]}>`
      const col = colIndex(attr(tag, 'r') ?? '')
      const type = attr(tag, 't')
      const style = Number(attr(tag, 's') ?? '-1')
      const body = c[2] ?? ''
      let value = ''
      if (type === 's') {
        const v = body.match(/<v>([\s\S]*?)<\/v>/)
        value = v ? shared[Number(v[1])] ?? '' : ''
      } else if (type === 'inlineStr') {
        value = innerTexts(body)
      } else {
        const v = body.match(/<v>([\s\S]*?)<\/v>/)
        const raw = v ? decodeXml(v[1]) : ''
        if (type === 'str' || type === 'b' || type === 'e') value = raw
        else if (raw !== '') {
          const n = Number(raw)
          if (!Number.isFinite(n)) value = raw
          else if (dateStyles.has(style) && n > 0) value = serialToIso(n)
          else value = Number.isInteger(n) ? String(n) : n.toFixed(2)
        }
      }
      while (row.length < col) row.push('')
      row[col] = value
    }
    rows.push(row.map((v) => (v ?? '').trim()))
  }
  return rows.filter((r) => r.some((v) => v !== ''))
}
