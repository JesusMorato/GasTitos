import { beforeEach, describe, expect, it, vi } from 'vitest'
import { lockScroll, unlockScroll } from './scrollLock'

describe('scrollLock', () => {
  beforeEach(() => {
    document.body.className = ''
    document.body.style.top = ''
    window.scrollTo = vi.fn()
  })

  it('fija el body y recuerda el scroll al bloquear', () => {
    Object.defineProperty(window, 'scrollY', { value: 340, configurable: true })
    lockScroll()
    expect(document.body.classList.contains('sheet-open')).toBe(true)
    expect(document.body.style.top).toBe('-340px')
    unlockScroll()
    expect(document.body.classList.contains('sheet-open')).toBe(false)
    expect(document.body.style.top).toBe('')
    expect(window.scrollTo).toHaveBeenCalledWith(0, 340)
  })

  it('con dos hojas abiertas solo libera al cerrar la última', () => {
    lockScroll()
    lockScroll()
    unlockScroll()
    expect(document.body.classList.contains('sheet-open')).toBe(true)
    unlockScroll()
    expect(document.body.classList.contains('sheet-open')).toBe(false)
  })

  it('desbloquear de más no rompe nada', () => {
    unlockScroll()
    expect(document.body.classList.contains('sheet-open')).toBe(false)
  })
})
