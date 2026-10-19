import { describe, it, expect } from 'vitest'
import { parseDateStyles, parseSharedStrings, parseSheet, readXlsx } from './xlsx'

// Monta un zip de verdad (con deflate) para probar el lector de punta a punta.
async function zip(files: Record<string, string>, compress = true): Promise<ArrayBuffer> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const raw = enc.encode(content)
    const data = compress ? await deflate(raw) : raw
    const n = enc.encode(name)
    const local = new Uint8Array(30 + n.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(8, compress ? 8 : 0, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, raw.length, true)
    lv.setUint16(26, n.length, true)
    local.set(n, 30)
    const cd = new Uint8Array(46 + n.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(10, compress ? 8 : 0, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, raw.length, true)
    cv.setUint16(28, n.length, true)
    cv.setUint32(42, offset, true)
    cd.set(n, 46)
    parts.push(local, data)
    central.push(cd)
    offset += local.length + data.length
  }
  const cdSize = central.reduce((a, c) => a + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(10, central.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)
  const all = [...parts, ...central, eocd]
  const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0))
  let p = 0
  for (const c of all) { out.set(c, p); p += c.length }
  return out.buffer
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Response(data as BodyInit).body!.pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

const SHARED = '<sst><si><t>Fecha</t></si><si><t>Concepto</t></si><si><t>Importe</t></si><si><r><t>Mercadona </t></r><r><t>Madrid</t></r></si><si><t>Caf&#233; &amp; t&#xE9;</t></si></sst>'
const STYLES = '<styleSheet><numFmts><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/><numFmt numFmtId="165" formatCode="#,##0.00"/></numFmts><cellXfs><xf numFmtId="0"/><xf numFmtId="164"/><xf numFmtId="165"/><xf numFmtId="14"/></cellXfs></styleSheet>'
const SHEET = `<worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" s="1"><v>46304</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" s="2"><v>-45.3</v></c></row>
<row r="3"><c r="A3" s="3"><v>46303</v></c><c r="B3" t="inlineStr"><is><t>Luz</t></is></c><c r="C3"><v>-60</v></c></row>
<row r="4"><c r="A4" t="str"><v>19/10/2026</v></c><c r="B4" t="s"><v>4</v></c><c r="C4"><v>-1.5</v></c><c r="E4"><v>7</v></c></row>
</sheetData></worksheet>`

describe('xlsx', () => {
  it('textos compartidos, con trozos y entidades', () => {
    expect(parseSharedStrings(SHARED)).toEqual(['Fecha', 'Concepto', 'Importe', 'Mercadona Madrid', 'Café & té'])
  })
  it('estilos de fecha: los propios de Excel y los personalizados', () => {
    expect([...parseDateStyles(STYLES)]).toEqual([1, 3])
  })
  it('hoja → filas de texto, fechas en ISO y números con dos decimales', () => {
    const rows = parseSheet(SHEET, parseSharedStrings(SHARED), parseDateStyles(STYLES))
    expect(rows).toEqual([
      ['Fecha', 'Concepto', 'Importe'],
      ['2026-10-09', 'Mercadona Madrid', '-45.30'],
      ['2026-10-08', 'Luz', '-60'],
      ['19/10/2026', 'Café & té', '-1.50', '', '7'],
    ])
  })
  it('lee un .xlsx completo (zip con deflate)', async () => {
    const buf = await zip({
      '[Content_Types].xml': '<Types/>',
      'xl/workbook.xml': '<workbook/>',
      'xl/sharedStrings.xml': SHARED,
      'xl/styles.xml': STYLES,
      'xl/worksheets/sheet1.xml': SHEET,
    })
    const rows = await readXlsx(buf)
    expect(rows[1]).toEqual(['2026-10-09', 'Mercadona Madrid', '-45.30'])
  })
  it('también sin comprimir y sin textos compartidos', async () => {
    const buf = await zip({ 'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row r="1"><c r="A1"><v>5</v></c></row></sheetData></worksheet>' }, false)
    expect(await readXlsx(buf)).toEqual([['5']])
  })
  it('un zip sin hojas no es un Excel', async () => {
    await expect(readXlsx(await zip({ 'hola.xml': '<a/>' }))).rejects.toThrow()
  })
})
