<script setup lang="ts">
import { computed } from 'vue'
import type { Category, RecurringExpense } from '../types'
import { formatEur } from '../lib/money'
import CategoryIcon from './CategoryIcon.vue'
import UiIcon from './UiIcon.vue'

// Lista de gastos fijos con pausar / editar / borrar. La usan Ajustes (todos)
// y la vista Yo (solo los personales).
const props = defineProps<{
  items: RecurringExpense[]
  categoryById: Record<string, Category>
  nameOf: (id: string) => string
  /** Muestra la etiqueta personal/repartido/conjunta. */
  showKind?: boolean
  /** Separa la lista en bloques: cuenta conjunta, repartidos y personales. */
  grouped?: boolean
  emptyText: string
}>()
const emit = defineEmits<{
  (e: 'toggle', r: RecurringExpense): void
  (e: 'edit', r: RecurringExpense): void
  (e: 'delete', r: RecurringExpense): void
}>()

const kindLabel: Record<RecurringExpense['kind'], string> = { personal: 'personal', shared: 'repartido', pot: 'conjunta' }
// Bloques en el orden en que se enseñan (solo los que tienen algo)
const groupTitle: Record<RecurringExpense['kind'], string> = { pot: 'Cuenta conjunta', shared: 'Repartidos', personal: 'Personales' }
const groups = computed(() => {
  if (!props.grouped) return [{ kind: null as RecurringExpense['kind'] | null, items: props.items }]
  return (['pot', 'shared', 'personal'] as const)
    .map((kind) => ({ kind, items: props.items.filter((r) => r.kind === kind) }))
    .filter((g) => g.items.length > 0)
})
function everyLabel(n: number) {
  return n === 1 ? 'cada mes' : n === 12 ? 'cada año' : `cada ${n} meses`
}
</script>

<template>
  <div v-if="items.length === 0" class="empty">{{ emptyText }}</div>
  <template v-else>
  <div v-for="g in groups" :key="g.kind ?? 'all'" class="rec-group">
  <div v-if="g.kind" class="rec-group-title">{{ groupTitle[g.kind] }}</div>
  <ul class="list">
    <li v-for="r in g.items" :key="r.id" :style="{ opacity: r.active ? 1 : 0.55 }">
      <CategoryIcon :icon="categoryById[r.category_id]?.icon" :emoji="categoryById[r.category_id]?.emoji" :color="categoryById[r.category_id]?.color" />
      <div class="grow">
        <div class="ellipsis"><strong>{{ r.name }}</strong> <span v-if="showKind" class="tag muted">{{ kindLabel[r.kind] }}</span></div>
        <div class="tiny">
          {{ everyLabel(r.every_n_months) }}<span v-if="r.kind === 'shared'"> · paga {{ nameOf(r.user_id) }}</span><span v-if="!r.active"> · pausado</span>
        </div>
      </div>
      <span class="amount">{{ r.amount == null ? 'variable' : formatEur(r.amount) }}</span>
      <div class="actions">
        <button type="button" class="icon" :title="r.active ? 'Pausar' : 'Activar'" :aria-label="r.active ? 'Pausar' : 'Activar'" @click="emit('toggle', r)"><UiIcon :name="r.active ? 'pause' : 'play'" :size="18" /></button>
        <button type="button" class="icon" title="Editar" aria-label="Editar" @click="emit('edit', r)"><UiIcon name="pencil" :size="18" /></button>
        <button type="button" class="icon" title="Borrar" aria-label="Borrar" @click="emit('delete', r)"><UiIcon name="trash" :size="18" /></button>
      </div>
    </li>
  </ul>
  </div>
  </template>
</template>

<style scoped>
.rec-group + .rec-group { margin-top: 0.9rem; }
.rec-group-title {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--ink-3); padding: 0.2rem 0 0.1rem; border-bottom: 1px solid var(--line);
}
.rec-group-title + .list li:first-child { border-top: 0; }
</style>
