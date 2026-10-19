import { describe, it, expect } from 'vitest'
import {
  alreadyRecorded, cleanConcept, decodeText, detectLayout, excelSerialToIso, parseAmount, parseDate, parseDelimited, parseStatement,
  suggestFromHistory, type HistoryExpense,
} from './statement'

describe('parseDelimited', () => {
  it('adivina el separador y respeta comillas', () => {
    expect(parseDelimited('a;b;c\n1;"x;y";3\n')).toEqual([['a', 'b', 'c'], ['1', 'x;y', '3']])
    expect(parseDelimited('a,b\n"Dijo ""hola""",2')).toEqual([['a', 'b'], ['Dijo "hola"', '2']])
    expect(parseDelimited('a\tb\r\n1\t2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('quita el BOM y las líneas vacías', () => {
    expect(parseDelimited('﻿a;b\n\n1;2\n   \n')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('salto de línea dentro de comillas', () => {
    expect(parseDelimited('a;b\n"uno\ndos";2')).toEqual([['a', 'b'], ['uno\ndos', '2']])
  })
})

describe('parseAmount', () => {
  it('formatos españoles y con símbolo', () => {
    expect(parseAmount('-1.234,56 €')).toBe(-1234.56)
    expect(parseAmount('12,34')).toBe(12.34)
    expect(parseAmount('1.234')).toBe(1234)
    expect(parseAmount('−8')).toBe(-8)
    expect(parseAmount('(12,50)')).toBe(-12.5)
    expect(parseAmount('+3,00 EUR')).toBe(3)
  })
  it('formatos con punto decimal (Revolut, Excel)', () => {
    expect(parseAmount('-12.50')).toBe(-12.5)
    expect(parseAmount('1,234.56')).toBe(1234.56)
    expect(parseAmount('1234')).toBe(1234)
  })
  it('lo que no es un importe → null', () => {
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('Mercadona')).toBeNull()
    expect(parseAmount('19/10/2026')).toBeNull()
  })
})

describe('parseDate', () => {
  it('entiende los formatos habituales', () => {
    expect(parseDate('19/10/2026')).toBe('2026-10-19')
    expect(parseDate('5-3-26')).toBe('2026-03-05')
    expect(parseDate('19.10.2026 10:30')).toBe('2026-10-19')
    expect(parseDate('2026-10-19')).toBe('2026-10-19')
    expect(parseDate('2026-10-19T08:00:00')).toBe('2026-10-19')
    expect(parseDate('46304')).toBe(excelSerialToIso(46304))
  })
  it('rechaza lo que no es fecha', () => {
    expect(parseDate('Mercadona')).toBeNull()
    expect(parseDate('32/13/2026')).toBeNull()
    expect(parseDate('12,34')).toBeNull()
  })
  it('número de serie de Excel', () => {
    expect(excelSerialToIso(45658)).toBe('2025-01-01')
  })
})

describe('cleanConcept', () => {
  it('quita la paja del banco y pasa las mayúsculas a normal', () => {
    expect(cleanConcept('COMPRA EN MERCADONA   MADRID')).toBe('Mercadona Madrid')
    expect(cleanConcept('PAGO MOVIL EN CAFETERIA LA PLAZA, MADRID')).toBe('Cafeteria La Plaza, Madrid')
    expect(cleanConcept('RECIBO IBERDROLA CLIENTES')).toBe('Iberdrola Clientes')
    expect(cleanConcept('Compra tarj. 1234****5678 Amazon')).toBe('Amazon')
  })
  it('lo que ya está bien se deja igual', () => {
    expect(cleanConcept('Cena con amigos')).toBe('Cena con amigos')
    expect(cleanConcept('')).toBe('')
  })
})

const BBVA = `Fecha;F.Valor;Concepto;Movimiento;Importe;Divisa;Disponible
19/10/2026;19/10/2026;COMPRA EN MERCADONA;Pago con tarjeta;-45,30;EUR;1.200,00
18/10/2026;18/10/2026;NOMINA OCTUBRE;Transferencia;1.800,00;EUR;1.245,30
17/10/2026;17/10/2026;RECIBO NETFLIX;Recibo;-12,99;EUR;-554,70`

describe('detectLayout + parseStatement', () => {
  it('extracto con cabecera e importe con signo', () => {
    const rows = parseDelimited(BBVA)
    const layout = detectLayout(rows)!
    expect(layout).toMatchObject({ firstRow: 1, date: 0, concept: 2, amount: 4, debit: -1 })
    const r = parseStatement(rows)!
    expect(r.items).toEqual([
      { key: 0, date: '2026-10-19', concept: 'Mercadona', amount: 45.3 },
      { key: 2, date: '2026-10-17', concept: 'Netflix', amount: 12.99 },
    ])
    expect(r.incomes).toBe(1)
    expect(r.skipped).toBe(0)
  })
  it('la cabecera no tiene por qué ser la primera fila', () => {
    const rows = parseDelimited(`Extracto de cuenta\nTitular;Yo\n\n${BBVA}`)
    expect(parseStatement(rows)!.items).toHaveLength(2)
  })
  it('columnas separadas de cargo y abono', () => {
    const rows = parseDelimited('Fecha operación;Concepto;Cargo;Abono;Saldo\n01/10/2026;LUZ;60,00;;500\n02/10/2026;INGRESO;;100,00;600')
    const r = parseStatement(rows)!
    expect(r.items).toEqual([{ key: 0, date: '2026-10-01', concept: 'Luz', amount: 60 }])
    expect(r.incomes).toBe(1)
  })
  it('Revolut en inglés', () => {
    const rows = parseDelimited('Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance\nCARD_PAYMENT,Current,2026-10-18 09:00:00,2026-10-19 10:00:00,Lidl,-23.40,0.00,EUR,COMPLETED,100.00')
    const r = parseStatement(rows)!
    expect(r.items).toEqual([{ key: 0, date: '2026-10-19', concept: 'Lidl', amount: 23.4 }])
  })
  it('sin cabecera: deduce las columnas por el contenido', () => {
    const rows = parseDelimited('19/10/2026;COMPRA EN BAR PEPE;-7,50;992,50\n18/10/2026;CAJERO;-20,00;1000,00')
    const r = parseStatement(rows)!
    expect(r.items.map((i) => [i.concept, i.amount])).toEqual([['Bar Pepe', 7.5], ['Cajero', 20]])
  })
  it('si no hay ningún negativo, todo son cargos', () => {
    const rows = parseDelimited('Fecha;Concepto;Importe\n19/10/2026;Pan;2,10\n18/10/2026;Leche;1,05')
    expect(parseStatement(rows)!.items).toHaveLength(2)
  })
  it('archivo que no se entiende → null', () => {
    expect(parseStatement(parseDelimited('hola;que;tal\nuno;dos;tres'))).toBeNull()
    expect(parseStatement([])).toBeNull()
  })
})

const history: HistoryExpense[] = [
  { spent_on: '2026-09-01', amount: 40, category_id: 'super', description: 'Mercadona', is_shared: true, funding: 'pot', split_mode: 'household' },
  { spent_on: '2026-09-10', amount: 12.99, category_id: 'ocio', description: 'Netflix', is_shared: false, funding: 'personal', split_mode: 'household' },
  { spent_on: '2026-09-20', amount: 30, category_id: 'super2', description: 'Compra Mercadona', is_shared: true, funding: 'personal', split_mode: 'household' },
]

describe('suggestFromHistory', () => {
  it('prefiere el concepto exacto, sin tildes ni mayúsculas', () => {
    expect(suggestFromHistory('MERCADONA', history)).toEqual({ category_id: 'super', kind: 'pot', split_mode: 'household' })
  })
  it('si no hay exacto, el más reciente que se parezca', () => {
    expect(suggestFromHistory('Compra Mercadona Madrid', history)).toEqual({ category_id: 'super2', kind: 'shared', split_mode: 'household' })
    expect(suggestFromHistory('netflix.com', history)?.category_id).toBe('ocio')
  })
  it('sin parecido → null', () => {
    expect(suggestFromHistory('Gasolinera', history)).toBeNull()
    expect(suggestFromHistory('ab', history)).toBeNull()
  })
})

describe('alreadyRecorded', () => {
  it('misma fecha y mismo importe', () => {
    expect(alreadyRecorded({ date: '2026-09-10', amount: 12.99 }, history)).toBe(true)
    expect(alreadyRecorded({ date: '2026-09-11', amount: 12.99 }, history)).toBe(false)
    expect(alreadyRecorded({ date: '2026-09-10', amount: 13 }, history)).toBe(false)
  })
})

describe('decodeText', () => {
  it('UTF-8 normal', () => {
    expect(decodeText(new TextEncoder().encode('Cañas').buffer)).toBe('Cañas')
  })
  it('Windows-1252 (Excel antiguo) no rompe las tildes', () => {
    const bytes = new Uint8Array([0x43, 0x61, 0xf1, 0x61, 0x73]) // "Cañas" en 1252
    expect(decodeText(bytes.buffer)).toBe('Cañas')
  })
})
