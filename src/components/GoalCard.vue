<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Contribution, SavingsGoal } from '../types'
import { formatDate, formatEur, goalProgress, todayIso } from '../lib/money'

const props = defineProps<{
  goal: SavingsGoal
  contributions: Contribution[]
  saved: number
  nameOf: (id: string) => string
  currentUserId: string
  editable: boolean
  privacyToggle?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', g: SavingsGoal): void
  (e: 'delete', g: SavingsGoal): void
  (e: 'toggle-public', g: SavingsGoal): void
  (e: 'contribute', g: SavingsGoal, amount: number, date: string, note: string | null): void
  (e: 'delete-contribution', c: Contribution): void
}>()

const open = ref(false)
const amount = ref<number>(0)
const date = ref(todayIso())
const note = ref('')

const progress = computed(() => goalProgress(props.saved, props.goal.target_amount))
const pct = computed(() => Math.min(100, Math.round(progress.value * 100)))
const remaining = computed(() => Math.max(0, props.goal.target_amount - props.saved))

function contribute() {
  if (!(amount.value > 0)) return
  emit('contribute', props.goal, Number(amount.value), date.value, note.value.trim() || null)
  amount.value = 0
  note.value = ''
}
</script>

<template>
  <div class="card">
    <div class="row between">
      <div class="grow">
        <h3>
          {{ goal.name }}
          <span v-if="privacyToggle" class="tag" :class="goal.is_public ? '' : 'muted'">
            {{ goal.is_public ? 'Público' : 'Privado' }}
          </span>
          <span v-if="pct >= 100" class="tag">¡Conseguido!</span>
        </h3>
        <div class="muted">
          {{ formatEur(saved) }} de {{ formatEur(goal.target_amount) }}
          <span v-if="goal.deadline"> · antes del {{ formatDate(goal.deadline) }}</span>
        </div>
      </div>
      <div v-if="editable" class="row" style="gap: .1rem">
        <button v-if="privacyToggle" class="ghost small" :title="goal.is_public ? 'Hacer privado' : 'Hacer público'" @click="emit('toggle-public', goal)">
          {{ goal.is_public ? '🔓' : '🔒' }}
        </button>
        <button class="ghost small" title="Editar" @click="emit('edit', goal)">✏️</button>
        <button class="ghost small" title="Borrar" @click="emit('delete', goal)">🗑️</button>
      </div>
    </div>

    <div class="progress"><div :style="{ width: pct + '%' }" /></div>
    <div class="row between muted">
      <span>{{ pct }} %</span>
      <span v-if="remaining > 0">faltan {{ formatEur(remaining) }}</span>
    </div>

    <button class="ghost small" style="margin-top: .4rem" @click="open = !open">
      {{ open ? 'Ocultar aportaciones' : `Aportaciones (${contributions.length})` }}
    </button>

    <div v-if="open">
      <ul class="list">
        <li v-for="c in contributions" :key="c.id">
          <div class="grow">
            <div>{{ nameOf(c.user_id) }}<span v-if="c.note" class="muted"> · {{ c.note }}</span></div>
            <div class="muted">{{ formatDate(c.contributed_on) }}</div>
          </div>
          <span class="amount">{{ formatEur(c.amount) }}</span>
          <button v-if="editable && c.user_id === currentUserId" class="ghost small" title="Borrar" @click="emit('delete-contribution', c)">🗑️</button>
        </li>
      </ul>

      <form v-if="editable" class="row" style="margin-top: .6rem" @submit.prevent="contribute">
        <input v-model.number="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="€" style="max-width: 110px" required />
        <input v-model="date" type="date" style="max-width: 160px" required />
        <input v-model="note" placeholder="Nota" maxlength="80" class="grow" style="min-width: 120px" />
        <button type="submit" class="small">Aportar</button>
      </form>
    </div>
  </div>
</template>
