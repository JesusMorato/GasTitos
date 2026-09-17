// Mes seleccionado, compartido por toda la app (selector en la barra superior).
import { ref } from 'vue'
import { monthOf, todayIso } from '../lib/money'

const month = ref(monthOf(todayIso()))

export function useMonth() {
  function shift(delta: number) {
    const [y, m] = month.value.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    month.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }
  function reset() {
    month.value = monthOf(todayIso())
  }
  /** ¿Es el mes de hoy? Sin argumento, comprueba el mes seleccionado. */
  function isCurrent(m: string = month.value) {
    return m === monthOf(todayIso())
  }
  return { month, shift, reset, isCurrent }
}
