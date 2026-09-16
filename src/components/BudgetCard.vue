<script setup lang="ts">
import { computed, ref } from 'vue'
import { budgetStatus, cumulativeByDay, dayCursor, daysInMonth, formatEur, formatMonth, round2 } from '../lib/money'
import BudgetChart from './BudgetChart.vue'
import Sheet from './Sheet.vue'

const props = defineProps<{
  /** Gastos que cuentan para este límite (ya filtrados por lo que toca). */
  items: Array<{ spent_on: string; amount: number }>
  month: string
  limit: number | null
  title?: string
  /** Texto del botón cuando no hay límite. */
  emptyHint?: string
}>()
const emit = defineEmits<{ (e: 'set-limit', v: number | null): void }>()

const cumulative = computed(() => cumulativeByDay(props.items, props.month))
const days = computed(() => daysInMonth(props.month))
const day = computed(() => dayCursor(props.month))
const spent = computed(() => (day.value > 0 ? cumulative.value[day.value - 1] ?? 0 : 0))
const status = computed(() => (props.limit ? budgetStatus(spent.value, props.limit, day.value, days.value) : null))
const isCurrent = computed(() => day.value > 0 && day.value < days.value)

const stateLabel = computed(() => {
  if (!status.value) return ''
  switch (status.value.state) {
    case 'under': return 'Vas bien'
    case 'over_pace': return 'Ojo, vas por encima del ritmo'
    case 'exceeded': return 'Límite superado'
  }
})
const stateClass = computed(() => {
  if (!status.value) return ''
  return status.value.state === 'under' ? '' : status.value.state === 'over_pace' ? 'warn' : 'neg'
})

const editing = ref(false)
const draft = ref<number>(props.limit ?? 0)
function openEdit() {
  draft.value = props.limit ?? 0
  editing.value = true
}
function save() {
  const v = round2(Number(draft.value))
  editing.value = false
  emit('set-limit', v > 0 ? v : null)
}
function remove() {
  editing.value = false
  emit('set-limit', null)
}
</script>

<template>
  <div class="card">
    <div class="row between" style="margin-bottom: 0.4rem">
      <h2>{{ title ?? 'Límite del mes' }}</h2>
      <button type="button" class="ghost small" @click="openEdit">{{ limit ? 'Cambiar' : 'Poner límite' }}</button>
    </div>

    <template v-if="limit && status">
      <div class="row between" style="align-items: baseline; margin-bottom: 0.3rem">
        <div class="tnum">
          <span class="hero-number" style="font-size: 1.5rem">{{ formatEur(status.spent) }}</span>
          <span class="muted"> de {{ formatEur(status.limit) }}</span>
        </div>
        <span class="tag" :class="stateClass">{{ stateLabel }}</span>
      </div>
      <div class="progress" :style="{ '--bar': status.state === 'exceeded' ? 'var(--neg)' : status.state === 'over_pace' ? 'var(--warn)' : 'var(--accent)' }">
        <div :style="{ width: Math.min(100, status.pct * 100) + '%' }" />
      </div>
      <p class="muted tnum" style="margin: 0.5rem 0 0.6rem">
        <template v-if="status.state === 'exceeded'">
          Te has pasado <strong>{{ formatEur(status.exceeded) }}</strong><template v-if="isCurrent"> y quedan {{ status.daysLeft }} días</template>.
        </template>
        <template v-else-if="isCurrent">
          Te quedan <strong>{{ formatEur(status.remaining) }}</strong> para {{ status.daysLeft }} días · <strong>{{ formatEur(status.perDay) }}/día</strong>
        </template>
        <template v-else-if="day === 0">
          {{ formatMonth(month) }} aún no ha empezado.
        </template>
        <template v-else>
          Mes cerrado: quedaron <strong>{{ formatEur(status.remaining) }}</strong> sin gastar.
        </template>
      </p>
      <BudgetChart :cumulative="cumulative" :day="day" :limit="limit" />
      <div class="row tiny" style="gap: 1rem; margin-top: 0.4rem">
        <span><span class="legend-line" style="--c: var(--neg); --dash: 7px 5px" /> Límite</span>
        <span><span class="legend-line" style="--c: var(--ink-3); --dash: 2px 4px" /> Ritmo</span>
        <span><span class="legend-line" style="--c: var(--accent); --dash: 0" /> Acumulado</span>
      </div>
    </template>

    <div v-else class="empty" style="padding: 0.6rem 0 0.2rem">
      <p class="muted" style="margin: 0 0 0.5rem">{{ emptyHint ?? 'Ponte un límite mensual y verás cómo te acercas a él día a día.' }}</p>
      <button type="button" class="secondary small" @click="openEdit">Poner límite mensual</button>
    </div>

    <Sheet v-if="editing" :title="limit ? 'Cambiar límite' : 'Límite mensual'" @close="editing = false">
      <form @submit.prevent="save">
        <div class="field amount-input">
          <label for="limit">Límite al mes</label>
          <input id="limit" v-model.number="draft" type="number" step="1" min="1" inputmode="decimal" placeholder="900" required autofocus />
        </div>
        <p class="help">Es orientativo: no bloquea nada, solo te avisa cuando vas rápido o te pasas.</p>
        <div class="row" style="justify-content: space-between">
          <button v-if="limit" type="button" class="ghost small" @click="remove">Quitar límite</button>
          <span v-else />
          <div class="row">
            <button type="button" class="ghost" @click="editing = false">Cancelar</button>
            <button type="submit">Guardar</button>
          </div>
        </div>
      </form>
    </Sheet>
  </div>
</template>
