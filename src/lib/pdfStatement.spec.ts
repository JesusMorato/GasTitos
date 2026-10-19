// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { groupLines, linesToTable, passwordProblem, pdfToLines, PDF_LAYOUT } from './pdfStatement'
import { parseStatement } from './statement'

describe('groupLines', () => {
  it('junta los trozos a la misma altura, de arriba abajo', () => {
    const lines = groupLines([
      { str: 'SALDO', x: 500, y: 800 },
      { str: '19/10/2026', x: 50, y: 780 },
      { str: 'FECHA', x: 50, y: 800.4 },
      { str: ' ', x: 90, y: 780 },
      { str: 'MERCADONA', x: 200, y: 779.5 },
      { str: '45,30', x: 400, y: 780 },
    ])
    expect(lines).toEqual(['FECHA SALDO', '19/10/2026 MERCADONA 45,30'])
  })
})

describe('linesToTable', () => {
  it('con saldo: el signo sale del cambio de saldo (de más antiguo a más nuevo)', () => {
    const t = linesToTable([
      'EXTRACTO DE CUENTA',
      'FECHA CONCEPTO IMPORTE SALDO',
      '01/10/2026 SALDO ANTERIOR 1.000,00',
      '02/10/2026 02/10/2026 COMPRA EN MERCADONA 45,30 954,70',
      '03/10/2026 03/10/2026 NOMINA OCTUBRE 1.800,00 2.754,70',
      '04/10/2026 04/10/2026 RECIBO LUZ 60,00 2.694,70',
      'Página 1 de 1',
    ])!
    expect(t[0]).toEqual(['Fecha', 'Concepto', 'Importe'])
    expect(t.slice(1)).toEqual([
      ['2026-10-02', 'COMPRA EN MERCADONA', '-45,30'],
      ['2026-10-03', 'NOMINA OCTUBRE', '1800,00'],
      ['2026-10-04', 'RECIBO LUZ', '-60,00'],
    ])
    const r = parseStatement(t, PDF_LAYOUT)!
    expect(r.items.map((i) => [i.date, i.concept, i.amount])).toEqual([
      ['2026-10-04', 'Luz', 60],
      ['2026-10-02', 'Mercadona', 45.3],
    ])
    expect(r.incomes).toBe(1)
  })

  it('con saldo, del más nuevo al más antiguo', () => {
    const t = linesToTable([
      '04/10/2026 RECIBO LUZ 60,00 2.694,70',
      '03/10/2026 NOMINA 1.800,00 2.754,70',
      '02/10/2026 MERCADONA 45,30 954,70',
      '01/10/2026 CAJERO 20,00 1.000,00',
    ])!
    expect(t.slice(1).map((r) => r[2])).toEqual(['-60,00', '1800,00', '-45,30', '20,00'])
  })

  it('sin saldo: se respeta el signo que trae', () => {
    const t = linesToTable(['19/10/2026 MERCADONA -45,30', '18/10/2026 NOMINA 1.800,00 €', '17/10/2026 BAR PEPE 7,50-'])!
    expect(t.slice(1).map((r) => r[2])).toEqual(['-45,30', '1800,00', '-7,50'])
  })

  it('fecha valor delante de los importes y líneas sin fecha ignoradas', () => {
    const t = linesToTable(['19/10/2026 COMPRA TARJ. AMAZON 19/10/2026 12,99 500,00', 'MADRID ES', 'Total 12,99'])!
    expect(t).toHaveLength(2)
    expect(t[1]).toEqual(['2026-10-19', 'COMPRA TARJ. AMAZON', '12,99'])
  })

  it('nada que parezca un movimiento → null', () => {
    expect(linesToTable(['hola', 'Página 1', ''])).toBeNull()
  })
})

// PDF mínimo hecho a mano (Helvetica, sin comprimir) para probar pdf.js de punta a punta.
function makePdf(pieces: Array<[number, number, string]>): ArrayBuffer {
  const content = pieces.map(([x, y, t]) => `BT /F1 10 Tf ${x} ${y} Td (${t}) Tj ET`).join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(out).buffer
}

describe('pdfToLines', () => {
  it('saca las líneas de un PDF y de ahí los movimientos', async () => {
    const buf = makePdf([
      [50, 800, 'FECHA'], [200, 800, 'CONCEPTO'], [400, 800, 'IMPORTE'], [500, 800, 'SALDO'],
      [50, 790, '01/10/2026'], [200, 790, 'SALDO ANTERIOR'], [500, 790, '1.000,00'],
      [50, 780, '02/10/2026'], [200, 780, 'COMPRA EN MERCADONA'], [400, 780, '45,30'], [500, 780, '954,70'],
      [50, 760, '03/10/2026'], [200, 760, 'NOMINA'], [400, 760, '1.800,00'], [500, 760, '2.754,70'],
    ])
    const lines = await pdfToLines(buf)
    expect(lines).toEqual(['FECHA CONCEPTO IMPORTE SALDO', '01/10/2026 SALDO ANTERIOR 1.000,00', '02/10/2026 COMPRA EN MERCADONA 45,30 954,70', '03/10/2026 NOMINA 1.800,00 2.754,70'])
    const r = parseStatement(linesToTable(lines)!, PDF_LAYOUT)!
    expect(r.items).toEqual([{ key: 0, date: '2026-10-02', concept: 'Mercadona', amount: 45.3 }])
    expect(r.incomes).toBe(1)
  }, 30000)

  it('un archivo que no es PDF da error', async () => {
    await expect(pdfToLines(new TextEncoder().encode('hola').buffer)).rejects.toThrow()
  }, 30000)
})

describe('passwordProblem', () => {
  it('distingue pedir contraseña de contraseña mal', () => {
    expect(passwordProblem({ name: 'PasswordException', code: 1 })).toBe('needed')
    expect(passwordProblem({ name: 'PasswordException', code: 2 })).toBe('wrong')
    expect(passwordProblem(new Error('otra cosa'))).toBeNull()
  })
})
