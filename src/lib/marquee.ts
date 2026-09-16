// Directiva v-marquee: si el texto está cortado con puntos suspensivos, al
// mantener pulsado el elemento el texto se desplaza en horizontal (como un
// marcador) y vuelve al principio al soltar.
import type { Directive } from 'vue'

const HOLD_MS = 280
const SPEED = 60 // px por segundo

interface State {
  timer: ReturnType<typeof setTimeout> | null
  raf: number | null
  start: number
  from: number
  active: boolean
}

const states = new WeakMap<HTMLElement, State>()

function stop(el: HTMLElement) {
  const s = states.get(el)
  if (!s) return
  if (s.timer) clearTimeout(s.timer)
  if (s.raf) cancelAnimationFrame(s.raf)
  s.timer = null
  s.raf = null
  s.active = false
  el.classList.remove('marquee-on')
  el.style.transform = ''
}

function run(el: HTMLElement) {
  const s = states.get(el)
  if (!s) return
  const inner = el.firstElementChild as HTMLElement | null
  const target = inner ?? el
  const overflow = target.scrollWidth - el.clientWidth
  if (overflow <= 2) return
  s.active = true
  s.start = performance.now()
  el.classList.add('marquee-on')
  const step = (t: number) => {
    if (!s.active) return
    const elapsed = (t - s.start) / 1000
    // Va y vuelve: 0 → overflow → 0, con una pausa corta en cada extremo.
    const period = (overflow / SPEED) * 2 + 1
    const x = elapsed % period
    let offset: number
    if (x < overflow / SPEED) offset = x * SPEED
    else if (x < overflow / SPEED + 0.5) offset = overflow
    else if (x < (overflow / SPEED) * 2 + 0.5) offset = overflow - (x - overflow / SPEED - 0.5) * SPEED
    else offset = 0
    target.style.transform = `translateX(${-offset}px)`
    s.raf = requestAnimationFrame(step)
  }
  s.raf = requestAnimationFrame(step)
}

export const vMarquee: Directive<HTMLElement> = {
  mounted(el) {
    const s: State = { timer: null, raf: null, start: 0, from: 0, active: false }
    states.set(el, s)
    const down = () => {
      stop(el)
      s.timer = setTimeout(() => run(el), HOLD_MS)
    }
    const up = () => {
      const inner = el.firstElementChild as HTMLElement | null
      stop(el)
      if (inner) inner.style.transform = ''
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', up)
    el.addEventListener('contextmenu', (e) => e.preventDefault())
  },
  unmounted(el) {
    stop(el)
    states.delete(el)
  },
}
