<script setup lang="ts">
import { ref } from 'vue'
import type { ScriptableContext } from 'chart.js'
import { useChart } from '../composables/useChart'
import { chartTheme, eurTick, withAlpha } from '../lib/charts'
import { formatEur } from '../lib/money'

const props = defineProps<{
  /** Acumulado por día (un valor por día del mes). */
  cumulative: number[]
  /** Hasta qué día (1..days) se dibuja la curva. 0 = nada todavía. */
  day: number
  limit: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

useChart(
  canvas,
  (el) => {
    const t = chartTheme(el)
    const days = props.cumulative.length
    const labels = Array.from({ length: days }, (_, i) => String(i + 1))
    const actual = props.cumulative.map((v, i) => (i < props.day ? v : null))
    const pace = labels.map((_, i) => Math.round(((props.limit * (i + 1)) / days) * 100) / 100)
    const limitLine = Array(days).fill(props.limit)
    const yMax = Math.max(props.limit * 1.15, ...props.cumulative.slice(0, props.day), 1)

    return {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Gastado',
            data: actual,
            borderColor: t.accent,
            borderWidth: 2.5,
            tension: 0.25,
            spanGaps: false,
            pointRadius: (c: ScriptableContext<'line'>) => (c.dataIndex === props.day - 1 ? 4 : 0),
            pointBackgroundColor: (c: ScriptableContext<'line'>) => ((actual[c.dataIndex] ?? 0) > props.limit ? t.neg : t.accent),
            pointBorderColor: t.surface,
            pointBorderWidth: 2,
            segment: {
              borderColor: (c) => ((c.p0.parsed.y ?? 0) > props.limit || (c.p1.parsed.y ?? 0) > props.limit ? t.neg : t.accent),
            },
            fill: { target: { value: props.limit }, above: withAlpha(t.neg, 0.18), below: withAlpha(t.accent, 0.12) },
            order: 1,
          },
          {
            label: 'Límite',
            data: limitLine,
            borderColor: t.neg,
            borderDash: [7, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
            order: 2,
          },
          {
            label: 'Ritmo',
            data: pace,
            borderColor: t.ink3,
            borderDash: [2, 4],
            borderWidth: 1.2,
            pointRadius: 0,
            fill: false,
            order: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: t.ink3,
              font: { family: t.font, size: 10 },
              autoSkip: false,
              callback: (_v, i) => (i === 0 || (i + 1) % 5 === 0 ? String(i + 1) : ''),
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: yMax,
            grid: { color: t.line },
            border: { display: false },
            ticks: { color: t.ink3, font: { family: t.font, size: 10 }, maxTicksLimit: 4, callback: (v) => eurTick(v) },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            filter: (item) => item.datasetIndex === 0,
            callbacks: {
              title: (items) => `Día ${items[0]?.label ?? ''}`,
              label: (c) => ` Acumulado: ${formatEur(Number(c.parsed.y))}`,
              afterLabel: (c) => {
                const v = Number(c.parsed.y)
                const p = pace[c.dataIndex] ?? 0
                if (v > props.limit) return ` Límite superado en ${formatEur(v - props.limit)}`
                return v > p ? ` Por encima del ritmo (${formatEur(p)})` : ` Por debajo del ritmo (${formatEur(p)})`
              },
            },
          },
        },
      },
    }
  },
  () => [props.cumulative, props.day, props.limit],
)
</script>

<template>
  <div class="chart-box" style="height: 190px"><canvas ref="canvas" role="img" aria-label="Gasto acumulado frente al límite del mes" /></div>
</template>
