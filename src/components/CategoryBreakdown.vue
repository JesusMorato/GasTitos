<script setup lang="ts">
import type { Category } from '../types'
import type { BreakdownRow } from '../lib/breakdown'
import { formatDate, formatEur } from '../lib/money'
import CategoryIcon from './CategoryIcon.vue'
import UiIcon from './UiIcon.vue'

// Leyenda del donut. Al pulsar una categoría (o su trozo del donut, que
// comparte `open` con la vista) se despliega, con animación, la lista de
// gastos que la componen y la suma al final.
defineProps<{
  rows: BreakdownRow[]
  categoryById: Record<string, Category>
}>()

// Clave de la categoría desplegada (null = ninguna). v-model:open.
const open = defineModel<string | null>('open', { default: null })

function toggle(key: string) {
  open.value = open.value === key ? null : key
}
</script>

<template>
  <ul class="donut-legend" :class="{ scrolling: rows.length > 5 && !open, 'has-open': !!open }">
    <li
      v-for="r in rows"
      :key="r.key"
      class="expandable"
      :class="{ open: open === r.key }"
      :style="{ '--dot': categoryById[r.key]?.color ?? '#7a857f' }"
    >
      <button type="button" class="legend-toggle" :aria-expanded="open === r.key" @click="toggle(r.key)">
        <span class="dot" />
        <span class="name">
          <CategoryIcon variant="inline" :icon="categoryById[r.key]?.icon" :emoji="categoryById[r.key]?.emoji" :color="categoryById[r.key]?.color" />
          {{ categoryById[r.key]?.name ?? 'Otros' }}
          <span class="tiny">· {{ r.items.length }} {{ r.items.length === 1 ? 'gasto' : 'gastos' }}</span>
        </span>
        <span class="val">{{ formatEur(r.total) }}</span>
        <UiIcon name="chevronDown" :size="16" class="chevron" />
      </button>
      <div class="fold">
        <div class="fold-inner">
          <ul class="breakdown">
            <li v-for="(it, i) in r.items" :key="it.id" :style="{ '--i': i }">
              <span class="tiny tnum">{{ formatDate(it.date) }}</span>
              <span class="grow ellipsis">{{ it.label }}<span v-if="it.note" class="muted"> · {{ it.note }}</span></span>
              <span class="tnum">{{ formatEur(it.amount) }}</span>
            </li>
            <li class="sum" :style="{ '--i': r.items.length }">
              <span class="tiny">Suma</span>
              <span class="grow" />
              <strong class="tnum">= {{ formatEur(r.total) }}</strong>
            </li>
          </ul>
        </div>
      </div>
    </li>
  </ul>
</template>
