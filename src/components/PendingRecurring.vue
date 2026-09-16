<script setup lang="ts">
import { reactive } from 'vue'
import type { Category, RecurringExpense, RecurringRun } from '../types'
import { formatEur, formatMonth, round2 } from '../lib/money'
import CategoryIcon from './CategoryIcon.vue'
import UiIcon from './UiIcon.vue'

const props = defineProps<{
  items: Array<{ run: RecurringRun; recurring: RecurringExpense }>
  categoryById: Record<string, Category>
  lastAmountOf: (recurringId: string) => number | null
}>()
const emit = defineEmits<{ (e: 'resolve', runId: string, amount: number): void; (e: 'skip', runId: string): void }>()

const drafts = reactive<Record<string, number>>({})

function draft(id: string, recurringId: string): number {
  if (!(id in drafts)) drafts[id] = props.lastAmountOf(recurringId) ?? 0
  return drafts[id]
}

function submit(runId: string) {
  const v = round2(Number(drafts[runId]))
  if (v > 0) emit('resolve', runId, v)
}
</script>

<template>
  <div v-if="items.length" class="card pending">
    <div class="row" style="gap: 0.4rem; margin-bottom: 0.5rem">
      <UiIcon name="clock" :size="18" />
      <h2>Gastos fijos pendientes</h2>
    </div>
    <p class="tiny" style="margin-bottom: 0.5rem">Toca poner el importe de este mes. Se sugiere el del mes anterior.</p>
    <ul class="list">
      <li v-for="it in items" :key="it.run.id" style="flex-wrap: wrap">
        <CategoryIcon :icon="categoryById[it.recurring.category_id]?.icon" :emoji="categoryById[it.recurring.category_id]?.emoji" :color="categoryById[it.recurring.category_id]?.color" />
        <div class="grow">
          <div class="ellipsis"><strong>{{ it.recurring.name }}</strong></div>
          <div class="tiny">{{ formatMonth(it.run.month) }}<span v-if="lastAmountOf(it.recurring.id) != null"> · anterior {{ formatEur(lastAmountOf(it.recurring.id)!) }}</span></div>
        </div>
        <form class="row" style="gap: 0.35rem; flex: none" @submit.prevent="submit(it.run.id)">
          <input
            :value="draft(it.run.id, it.recurring.id)"
            type="number"
            step="0.01"
            min="0.01"
            inputmode="decimal"
            placeholder="€"
            aria-label="Importe"
            style="width: 96px"
            @input="drafts[it.run.id] = Number(($event.target as HTMLInputElement).value)"
          />
          <button type="submit" class="small">Apuntar</button>
          <button type="button" class="ghost small" title="Este mes no" @click="emit('skip', it.run.id)">Saltar</button>
        </form>
      </li>
    </ul>
  </div>
</template>
