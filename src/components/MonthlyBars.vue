<script setup lang="ts">
import { ref } from 'vue'
import type { ChartDataset } from 'chart.js'
import { useChart } from '../composables/useChart'
import { chartTheme, eurTick, withAlpha } from '../lib/charts'
import { formatEur, round2 } from '../lib/money'

const props = defineProps<{
  labels: string[]
  datasets: Array<{ label: string; values: number[]; color?: string }>
  /** Línea discontinua con la media de los totales. */
  average?: boolean
  /** Índice de la barra "actual" (se resalta). */
  highlight?: number
  height?: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

useChart(
  canvas,
  (el) => {
    const t = chartTheme(el)
    const n = props.labels.length
    const totals = Array.from({ length: n }, (_, i) => round2(props.datasets.reduce((a, d) => a + (d.values[i] ?? 0), 0)))
    const avg = n ? round2(totals.reduce((a, b) => a + b, 0) / n) : 0
    const bars: ChartDataset<'bar' | 'line', number[]>[] = props.datasets.map((d) => {
      const color = d.color ?? t.accent
      return {
        type: 'bar' as const,
        label: d.label,
        data: d.values,
        backgroundColor: d.values.map((_, i) => (props.highlight === i ? color : withAlpha(color, 0.55))),
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 36,
      }
    })
    if (props.average && n > 1) {
      bars.push({
        type: 'line' as const,
        label: 'Media',
        data: Array(n).fill(avg),
        borderColor: t.ink3,
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        fill: false,
      })
    }
    return {
      type: 'bar',
      data: { labels: props.labels, datasets: bars as ChartDataset<'bar', number[]>[] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            stacked: props.datasets.length > 1,
            grid: { display: false },
            border: { display: false },
            ticks: { color: t.ink2, font: { family: t.font, size: 11 } },
          },
          y: {
            stacked: props.datasets.length > 1,
            beginAtZero: true,
            grid: { color: t.line },
            border: { display: false },
            ticks: { color: t.ink3, font: { family: t.font, size: 10 }, maxTicksLimit: 4, callback: (v) => eurTick(v) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) => ` ${c.dataset.label}: ${formatEur(Number(c.parsed.y))}`,
              footer: (items) => (props.datasets.length > 1 ? `Total: ${formatEur(totals[items[0]?.dataIndex ?? 0] ?? 0)}` : ''),
            },
          },
        },
      },
    }
  },
  () => [props.labels, props.datasets, props.average, props.highlight],
)
</script>

<template>
  <div class="chart-box" :style="{ height: (height ?? 170) + 'px' }"><canvas ref="canvas" role="img" aria-label="Gasto por mes" /></div>
</template>
