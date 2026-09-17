<script setup lang="ts">
import { reactive, watch } from 'vue'
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
// Pendientes ya enviados: se desactivan sus botones hasta que desaparecen de la
// lista, para que un doble toque no dé error de "ya no está pendiente".
const sent = reactive<Record<string, boolean>>({})
watch(
  () => props.items.map((it) => it.run.id),
  (ids) => {
    for (const id of Object.keys(sent)) if (!ids.includes(id)) delete sent[id]
  },
)

function draft(id: string, recurringId: string): number {
  if (!(id in drafts)) drafts[id] = props.lastAmountOf(recurringId) ?? 0
  return drafts[id]
}

function submit(runId: string) {
  const v = round2(Number(drafts[runId]))
  if (!(v > 0) || sent[runId]) return
  sent[runId] = true
  emit('resolve', runId, v)
}

function skip(runId: string) {
  if (sent[runId]) return
  sent[runId] = true
  emit('skip', runId)
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
      <li v-for="it in items" :key="it.run.id" class="pending-item">
        <div class="pending-head">
          <CategoryIcon :icon="categoryById[it.recurring.category_id]?.icon" :emoji="categoryById[it.recurring.category_id]?.emoji" :color="categoryById[it.recurring.category_id]?.color" />
          <div class="grow">
            <div class="ellipsis"><strong>{{ it.recurring.name }}</strong></div>
            <div class="tiny">{{ formatMonth(it.run.month) }}<span v-if="lastAmountOf(it.recurring.id) != null"> · anterior {{ formatEur(lastAmountOf(it.recurring.id)!) }}</span></div>
          </div>
        </div>
        <form class="pending-form" @submit.prevent="submit(it.run.id)">
          <div class="amount-input grow">
            <input
              :value="draft(it.run.id, it.recurring.id)"
              type="number"
              step="0.01"
              min="0.01"
              inputmode="decimal"
              placeholder="0,00"
              aria-label="Importe"
              @input="drafts[it.run.id] = Number(($event.target as HTMLInputElement).value)"
            />
          </div>
          <button type="submit" class="small" :disabled="sent[it.run.id]">{{ sent[it.run.id] ? 'Apuntando…' : 'Apuntar' }}</button>
          <button type="button" class="ghost small" title="Este mes no" :disabled="sent[it.run.id]" @click="skip(it.run.id)">Saltar</button>
        </form>
      </li>
    </ul>
  </div>
</template>
