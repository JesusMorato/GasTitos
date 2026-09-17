import { describe, expect, it } from 'vitest'
import { CATEGORY_ICONS, ICON_GROUPS, iconByKey, iconsByGroup } from './icons'
import { PALETTE } from '../types'

describe('iconos de categoría', () => {
  it('claves únicas y sin campos vacíos', () => {
    expect(CATEGORY_ICONS.length).toBeGreaterThanOrEqual(50)
    const keys = new Set(CATEGORY_ICONS.map((i) => i.key))
    expect(keys.size).toBe(CATEGORY_ICONS.length)
    for (const i of CATEGORY_ICONS) {
      expect(i.name).not.toBe('')
      expect(i.svg).toContain('<')
    }
  })

  it('siguen existiendo las 10 claves de serie (las usan las categorías guardadas)', () => {
    for (const k of ['casa', 'comida', 'transporte', 'ocio', 'salud', 'ropa', 'regalos', 'viajes', 'suscripciones', 'otros']) {
      expect(iconByKey(k)).toBeDefined()
    }
  })

  it('cada icono usa un color de la paleta', () => {
    for (const i of CATEGORY_ICONS) expect(PALETTE).toContain(i.color)
  })

  it('los grupos reparten todos los iconos, sin grupos vacíos', () => {
    const grouped = iconsByGroup()
    expect(grouped.map((g) => g.group)).toEqual([...ICON_GROUPS])
    expect(grouped.every((g) => g.icons.length > 0)).toBe(true)
    expect(grouped.reduce((n, g) => n + g.icons.length, 0)).toBe(CATEGORY_ICONS.length)
  })

  it('iconByKey encuentra los conocidos y devuelve undefined para el resto', () => {
    expect(iconByKey('casa')?.name).toBe('Casa')
    expect(iconByKey('no-existe')).toBeUndefined()
    expect(iconByKey(null)).toBeUndefined()
    expect(iconByKey(undefined)).toBeUndefined()
  })
})
