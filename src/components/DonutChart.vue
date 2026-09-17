<script setup lang="ts">
import { ref } from 'vue'
import type { Plugin } from 'chart.js'
import { useChart } from '../composables/useChart'
import { chartTheme } from '../lib/charts'
import { formatEur } from '../lib/money'

const props = defineProps<{
  items: Array<{ label: string; value: number; color: string }>
  total: number
  caption?: string
  /** Índice del trozo resaltado (se separa un poco del resto). */
  selected?: number | null
}>()
// Al pulsar un trozo se avisa con su índice; si ya era el elegido, con null.
const emit = defineEmits<{ (e: 'select', index: number | null): void }>()

const canvas = ref<HTMLCanvasElement | null>(null)

useChart(
  canvas,
  (el) => {
    const t = chartTheme(el)
    const centerText: Plugin<'doughnut'> = {
      id: 'centerText',
      afterDraw(chart) {
        const { ctx, chartArea } = chart
        if (!chartArea) return
        const cx = (chartArea.left + chartArea.right) / 2
        const cy = (chartArea.top + chartArea.bottom) / 2
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = t.ink
        ctx.font = `700 20px 'Sora', ${t.font}`
        ctx.fillText(formatEur(props.total), cx, cy - (props.caption ? 8 : 0))
        if (props.caption) {
          ctx.fillStyle = t.ink2
          ctx.font = `600 11px ${t.font}`
          ctx.fillText(props.caption, cx, cy + 14)
        }
        ctx.restore()
      },
    }
    const items = props.items.length ? props.items : [{ label: 'Sin gastos', value: 1, color: t.line }]
    return {
      type: 'doughnut',
      data: {
        labels: items.map((i) => i.label),
        datasets: [{
          data: items.map((i) => i.value),
          backgroundColor: items.map((i) => i.color),
          borderColor: t.surface,
          borderWidth: 2,
          hoverOffset: 4,
          offset: items.map((_, i) => (i === props.selected ? 12 : 0)),
        }],
      },
      options: {
        cutout: '70%',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        onClick: (_evt, elements) => {
          if (!props.items.length) return
          const i = elements[0]?.index
          emit('select', i === undefined || i === props.selected ? null : i)
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: props.items.length > 0,
            callbacks: { label: (c) => ` ${formatEur(Number(c.parsed))}` },
          },
        },
      },
      plugins: [centerText],
    }
  },
  () => [props.items, props.total, props.caption, props.selected],
)
</script>

<template>
  <div class="chart-box" style="height: 200px"><canvas ref="canvas" role="img" aria-label="Gasto por categoría" /></div>
</template>
