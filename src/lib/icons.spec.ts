import { describe, expect, it } from 'vitest'
import { CATEGORY_ICONS, iconByKey } from './icons'
import { PALETTE } from '../types'

describe('iconos de categoría', () => {
  it('hay diez, con claves únicas y sin campos vacíos', () => {
    expect(CATEGORY_ICONS).toHaveLength(10)
    const keys = new Set(CATEGORY_ICONS.map((i) => i.key))
    expect(keys.size).toBe(10)
    for (const i of CATEGORY_ICONS) {
      expect(i.name).not.toBe('')
      expect(i.svg).toContain('<')
    }
  })

  it('cada icono usa un color de la paleta', () => {
    for (const i of CATEGORY_ICONS) expect(PALETTE).toContain(i.color)
  })

  it('iconByKey encuentra los conocidos y devuelve undefined para el resto', () => {
    expect(iconByKey('casa')?.name).toBe('Casa')
    expect(iconByKey('no-existe')).toBeUndefined()
    expect(iconByKey(null)).toBeUndefined()
    expect(iconByKey(undefined)).toBeUndefined()
  })
})
