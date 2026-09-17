<script setup lang="ts">
import type { Category, RecurringExpense } from '../types'
import { formatEur } from '../lib/money'
import CategoryIcon from './CategoryIcon.vue'
import UiIcon from './UiIcon.vue'

// Lista de gastos fijos con pausar / editar / borrar. La usan Ajustes (todos)
// y la vista Yo (solo los personales).
defineProps<{
  items: RecurringExpense[]
  categoryById: Record<string, Category>
  nameOf: (id: string) => string
  /** Muestra la etiqueta personal/repartido/conjunta. */
  showKind?: boolean
  emptyText: string
}>()
const emit = defineEmits<{
  (e: 'toggle', r: RecurringExpense): void
  (e: 'edit', r: RecurringExpense): void
  (e: 'delete', r: RecurringExpense): void
}>()

const kindLabel: Record<RecurringExpense['kind'], string> = { personal: 'personal', shared: 'repartido', pot: 'conjunta' }
function everyLabel(n: number) {
  return n === 1 ? 'cada mes' : n === 12 ? 'cada año' : `cada ${n} meses`
}
</script>

<template>
  <div v-if="items.length === 0" class="empty">{{ emptyText }}</div>
  <ul v-else class="list">
    <li v-for="r in items" :key="r.id" :style="{ opacity: r.active ? 1 : 0.55 }">
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
</template>
