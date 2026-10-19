// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { EXTRACTO_CIFRADO_B64 } from './__fixtures__/extractoCifrado'
import { decryptOffice, isEncryptedOffice } from './officeCrypto'
import { readXlsx } from './xlsx'
import { parseStatement } from './statement'

// El archivo de prueba lo creó Excel 2016 ("Guardar como" con contraseña 1234):
// una hoja con Fecha / Concepto / Importe y dos filas.
const buf = Uint8Array.from(atob(EXTRACTO_CIFRADO_B64), (c) => c.charCodeAt(0)).buffer

describe('officeCrypto', () => {
  it('reconoce un Excel con contraseña', () => {
    expect(isEncryptedOffice(buf)).toBe(true)
    expect(isEncryptedOffice(new TextEncoder().encode('PK\u0003\u0004 zip normal').buffer)).toBe(false)
    expect(isEncryptedOffice(new ArrayBuffer(3))).toBe(false)
  })

  it('con la contraseña buena sale el .xlsx de siempre y se lee el extracto', async () => {
    const plain = await decryptOffice(buf, '1234')
    expect(new TextDecoder().decode(new Uint8Array(plain, 0, 2))).toBe('PK')
    const rows = await readXlsx(plain)
    expect(rows[0]).toEqual(['Fecha', 'Concepto', 'Importe'])
    const parsed = parseStatement(rows)!
    expect(parsed.items).toEqual([{ key: 0, date: '2026-10-19', concept: 'Mercadona', amount: 45.3 }])
    expect(parsed.incomes).toBe(1)
  }, 30000)

  it('con otra contraseña avisa sin romperse', async () => {
    await expect(decryptOffice(buf, '0000')).rejects.toThrow('Contraseña incorrecta')
  }, 30000)

  it('un archivo que no es OLE no se intenta', async () => {
    await expect(decryptOffice(new ArrayBuffer(600), '1234')).rejects.toThrow()
  })
})
