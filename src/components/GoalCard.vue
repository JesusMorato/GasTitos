<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Contribution, Member, SavingsGoal } from '../types'
import { formatDate, formatEur, formatMonth, goalProgress, monthlyPlan, monthsUntil, projectedMonth, round2, todayIso } from '../lib/money'
import UiIcon from './UiIcon.vue'
import SegmentedControl from './SegmentedControl.vue'

const props = defineProps<{
  goal: SavingsGoal
  contributions: Contribution[]
  saved: number
  nameOf: (id: string) => string
  currentUserId: string
  editable: boolean
  privacyToggle?: boolean
  /** Miembros del hogar: en huchas de pareja se enseña cuánto ha puesto cada uno. */
  members?: readonly Member[]
}>()

const emit = defineEmits<{
  (e: 'edit', g: SavingsGoal): void
  (e: 'delete', g: SavingsGoal): void
  (e: 'toggle-public', g: SavingsGoal): void
  (e: 'move', g: SavingsGoal, amount: number, date: string, note: string | null, direction: 'in' | 'out'): void
  (e: 'delete-contribution', c: Contribution): void
}>()

const open = ref(false)
const menu = ref(false)
const amount = ref<number>(0)
const date = ref(todayIso())
const note = ref('')
const direction = ref<'in' | 'out'>('in')
const dirOptions: Array<{ value: 'in' | 'out'; label: string }> = [
  { value: 'in', label: 'Meter' },
  { value: 'out', label: 'Sacar' },
]

const hasTarget = computed(() => props.goal.target_amount != null && props.goal.target_amount > 0)
const target = computed(() => props.goal.target_amount ?? 0)
const pct = computed(() => (hasTarget.value ? Math.min(100, Math.round(goalProgress(props.saved, target.value) * 100)) : 0))
const remaining = computed(() => (hasTarget.value ? Math.max(0, round2(target.value - props.saved)) : 0))
const done = computed(() => hasTarget.value && remaining.value <= 0)

const plan = computed(() => {
  if (!hasTarget.value || !props.goal.deadline || done.value) return null
  const months = monthsUntil(props.goal.deadline)
  if (months === 0) return { late: true, perMonth: remaining.value }
  return { late: false, perMonth: monthlyPlan(remaining.value, months) }
})
const projected = computed(() => (hasTarget.value && !done.value ? projectedMonth(remaining.value, props.contributions) : null))
const onTrack = computed(() => {
  if (!projected.value || !props.goal.deadline) return null
  return projected.value <= props.goal.deadline.slice(0, 7)
})

const byMember = computed(() => {
  if (!props.goal.is_shared || !props.members) return []
  return props.members.map((m) => ({
    name: m.display_name,
    total: round2(props.contributions.filter((c) => c.user_id === m.user_id).reduce((a, c) => a + (c.direction === 'out' ? -c.amount : c.amount), 0)),
  }))
})

function move() {
  const v = Number(amount.value)
  if (!(v > 0)) return
  emit('move', props.goal, round2(v), date.value, note.value.trim() || null, direction.value)
  amount.value = 0
  note.value = ''
}
</script>

<template>
  <div class="card" :style="{ '--bar': goal.color }">
    <div class="row" style="align-items: flex-start">
      <span class="emoji-badge lg" :style="{ '--badge': goal.color }">{{ goal.emoji }}</span>
      <div class="grow">
        <h3 class="row" style="gap: 0.4rem">
          {{ goal.name }}
          <span v-if="privacyToggle" class="tag" :class="goal.is_public ? '' : 'muted'">{{ goal.is_public ? 'Público' : 'Privado' }}</span>
          <span v-if="done" class="tag">¡Conseguido!</span>
        </h3>
        <div class="muted tnum">
          <strong>{{ formatEur(saved) }}</strong>
          <template v-if="hasTarget"> de {{ formatEur(target) }}</template>
          <template v-else> ahorrados</template>
          <span v-if="goal.deadline"> · antes del {{ formatDate(goal.deadline) }}</span>
        </div>
      </div>
      <div v-if="editable" class="actions">
        <button type="button" class="icon dots" title="Opciones" aria-label="Opciones" aria-haspopup="menu" :aria-expanded="menu" @click="menu = !menu">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </button>
        <div v-if="menu" class="menu" role="menu">
          <button type="button" role="menuitem" @click="menu = false; emit('edit', goal)">Editar</button>
          <button v-if="privacyToggle" type="button" role="menuitem" @click="menu = false; emit('toggle-public', goal)">
            {{ goal.is_public ? 'Hacer privada' : 'Hacer pública' }}
          </button>
          <button type="button" role="menuitem" class="destructive" @click="menu = false; emit('delete', goal)">Borrar</button>
        </div>
      </div>
    </div>

    <template v-if="hasTarget">
      <div class="progress" style="margin-top: 0.7rem"><div :style="{ width: pct + '%' }" /></div>
      <div class="row between tiny" style="margin-top: 0.3rem">
        <span class="tnum">{{ pct }} %</span>
        <span v-if="remaining > 0" class="tnum">faltan {{ formatEur(remaining) }}</span>
      </div>
      <p v-if="plan || projected !== undefined" class="muted tnum" style="margin: 0.4rem 0 0">
        <template v-if="plan && !plan.late">Te tocan <strong>{{ formatEur(plan.perMonth) }}/mes</strong> para llegar a tiempo.</template>
        <template v-else-if="plan && plan.late">La fecha ya ha pasado y faltan {{ formatEur(plan.perMonth) }}.</template>
        <template v-if="projected"> A tu ritmo llegas en <strong>{{ formatMonth(projected) }}</strong><span v-if="onTrack === true" class="tag" style="margin-left: 0.3rem">a tiempo</span><span v-else-if="onTrack === false" class="tag warn" style="margin-left: 0.3rem">tarde</span>.</template>
        <template v-else-if="!done && contributions.length"> Sin aportaciones en los últimos 3 meses, no hay previsión.</template>
      </p>
    </template>

    <div v-if="byMember.length" class="row tiny" style="gap: 1rem; margin-top: 0.5rem">
      <span v-for="m in byMember" :key="m.name">{{ m.name }} <strong class="tnum">{{ formatEur(m.total) }}</strong></span>
    </div>

    <button type="button" class="ghost small" style="margin-top: 0.4rem; padding-left: 0" @click="open = !open">
      <UiIcon :name="open ? 'chevronUp' : 'chevronDown'" :size="16" />
      {{ open ? 'Ocultar movimientos' : `Movimientos (${contributions.length})` }}
    </button>

    <div v-if="open">
      <ul class="list">
        <li v-for="c in contributions" :key="c.id">
          <span class="emoji-badge" :style="{ '--badge': c.direction === 'out' ? 'var(--neg)' : goal.color }" style="width: 32px; height: 32px; border-radius: 10px">
            <UiIcon :name="c.direction === 'out' ? 'arrowOut' : 'arrowIn'" :size="16" />
          </span>
          <div class="grow">
            <div>{{ nameOf(c.user_id) }}<span v-if="c.note" class="muted"> · {{ c.note }}</span></div>
            <div class="tiny">{{ formatDate(c.contributed_on) }}</div>
          </div>
          <span class="amount" :class="{ neg: c.direction === 'out' }">{{ c.direction === 'out' ? '−' : '+' }}{{ formatEur(c.amount) }}</span>
          <button v-if="editable && c.user_id === currentUserId" type="button" class="icon" title="Borrar" aria-label="Borrar movimiento" @click="emit('delete-contribution', c)"><UiIcon name="trash" :size="18" /></button>
        </li>
      </ul>

      <form v-if="editable" class="stack" style="margin-top: 0.6rem; gap: 0.5rem" @submit.prevent="move">
        <SegmentedControl v-model="direction" :options="dirOptions" small />
        <div class="row">
          <input v-model.number="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="€" style="max-width: 110px" required aria-label="Importe" />
          <input v-model="date" type="date" style="max-width: 160px" required aria-label="Fecha" />
          <input v-model="note" placeholder="Nota" maxlength="80" class="grow" style="min-width: 120px" aria-label="Nota" />
          <button type="submit" class="small">{{ direction === 'out' ? 'Sacar' : 'Meter' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>
