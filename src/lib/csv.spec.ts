import { describe, it, expect } from 'vitest'
import { csvCell, toCsv } from './csv'

describe('csv', () => {
  it('números con coma decimal y dos decimales', () => {
    expect(csvCell(12.5)).toBe('12,50')
    expect(csvCell(0)).toBe('0,00')
  })
  it('entrecomilla lo que lleva ; comillas o saltos', () => {
    expect(csvCell('Cena; con amigos')).toBe('"Cena; con amigos"')
    expect(csvCell('Dijo "hola"')).toBe('"Dijo ""hola"""')
    expect(csvCell('sin nada raro')).toBe('sin nada raro')
  })
  it('null → vacío', () => {
    expect(csvCell(null)).toBe('')
  })
  it('toCsv une con ; y CRLF', () => {
    expect(toCsv([['a', 'b'], [1, 'x;y']])).toBe('a;b\r\n1,00;"x;y"')
  })
})
