// Monta un Chart.js sobre un <canvas> y lo reconstruye cuando cambian los datos
// o el tema (claro/oscuro). Reconstruir es más simple que actualizar en sitio y
// las gráficas de la app son pequeñas.
import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import type { ChartConfiguration, ChartType } from 'chart.js'
import { Chart } from '../lib/charts'

export function useChart<T extends ChartType>(
  canvas: Ref<HTMLCanvasElement | null>,
  build: (el: HTMLCanvasElement) => ChartConfiguration<T>,
  deps: () => unknown,
) {
  let chart: Chart | null = null
  const mq = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null

  function render() {
    const el = canvas.value
    if (!el) return
    chart?.destroy()
    chart = new Chart(el, build(el) as ChartConfiguration)
  }

  onMounted(() => {
    render()
    mq?.addEventListener('change', render)
  })
  watch(deps, render, { deep: true })
  onBeforeUnmount(() => {
    mq?.removeEventListener('change', render)
    chart?.destroy()
    chart = null
  })
}
