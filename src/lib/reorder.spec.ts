import { describe, expect, it } from 'vitest'
import { indexAtY, moveItem, sortOrderUpdates } from './reorder'

describe('moveItem', () => {
  it('mueve hacia abajo', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })
  it('mueve hacia arriba', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
  it('no toca la lista si el destino es el mismo o está fuera', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], -1, 0)).toEqual(['a', 'b'])
  })
  it('no modifica la lista original', () => {
    const list = ['a', 'b', 'c']
    moveItem(list, 0, 2)
    expect(list).toEqual(['a', 'b', 'c'])
  })
})

describe('sortOrderUpdates', () => {
  it('no devuelve nada si el orden ya está bien', () => {
    const list = [{ id: 'a', sort_order: 10 }, { id: 'b', sort_order: 20 }]
    expect(sortOrderUpdates(list)).toEqual([])
  })
  it('solo devuelve los que cambian, de 10 en 10', () => {
    const list = [{ id: 'b', sort_order: 20 }, { id: 'a', sort_order: 10 }, { id: 'c', sort_order: 30 }]
    expect(sortOrderUpdates(list)).toEqual([{ id: 'b', sort_order: 10 }, { id: 'a', sort_order: 20 }])
  })
  it('normaliza valores raros (todos a 0)', () => {
    const list = [{ id: 'a', sort_order: 0 }, { id: 'b', sort_order: 0 }]
    expect(sortOrderUpdates(list)).toEqual([{ id: 'a', sort_order: 10 }, { id: 'b', sort_order: 20 }])
  })
})

describe('indexAtY', () => {
  const rows = [{ top: 0, bottom: 40 }, { top: 40, bottom: 80 }, { top: 80, bottom: 120 }]
  it('cae en la fila cuya mitad supera el puntero', () => {
    expect(indexAtY(rows, 5)).toBe(0)
    expect(indexAtY(rows, 30)).toBe(1)
    expect(indexAtY(rows, 75)).toBe(2)
  })
  it('por debajo de todo, la última', () => {
    expect(indexAtY(rows, 500)).toBe(2)
  })
  it('sin filas devuelve 0', () => {
    expect(indexAtY([], 10)).toBe(0)
  })
})
