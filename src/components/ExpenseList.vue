<script setup lang="ts">
import { ref } from 'vue'
import type { Category, Expense } from '../types'
import { describeSplit, formatDate, formatEur, type Share } from '../lib/money'
import Sheet from './Sheet.vue'

type Row = Expense & { shares: Share[] }

const props = defineProps<{
  expenses: Row[]
  categoryById: Record<string, Category>
  nameOf: (id: string) => string
  editable: boolean
  privacyToggle?: boolean
  showPayer?: boolean
  showSplit?: boolean
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'edit', x: Row): void
  (e: 'delete', x: Row): void
  (e: 'toggle-public', x: Row): void
}>()

// Gasto cuyo menú de tres puntos está abierto (undefined = ninguno).
const menuFor = ref<Row | undefined>(undefined)

function titleOf(x: Row) {
  return x.description || props.categoryById[x.category_id]?.name || 'Gasto'
}

function edit(x: Row) {
  menuFor.value = undefined
  emit('edit', x)
}

function remove(x: Row) {
  menuFor.value = undefined
  emit('delete', x)
}

function togglePublic(x: Row) {
  menuFor.value = undefined
  emit('toggle-public', x)
}
</script>

<template>
  <div v-if="expenses.length === 0" class="empty">{{ emptyText ?? 'Nada por aquí todavía.' }}</div>
  <ul v-else class="list">
    <li v-for="x in expenses" :key="x.id">
      <span class="emoji-badge" :style="{ '--badge': categoryById[x.category_id]?.color ?? '#7a857f' }">
        {{ categoryById[x.category_id]?.emoji ?? '📦' }}
      </span>
      <div class="grow">
        <div class="ellipsis">
          <strong>{{ x.description || categoryById[x.category_id]?.name || 'Gasto' }}</strong>
          <span v-if="x.description" class="muted"> · {{ categoryById[x.category_id]?.name }}</span>
        </div>
        <div class="tiny">
          {{ formatDate(x.spent_on) }}
          <template v-if="showPayer && x.is_shared">
            <span v-if="x.funding === 'pot'"> · cuenta conjunta</span>
            <span v-else> · pagó {{ nameOf(x.user_id) }}</span>
          </template>
          <span v-if="showSplit && x.is_shared && x.funding === 'personal'">
            · {{ describeSplit(x.split_mode, x.shares, x.amount, x.user_id, nameOf) }}
          </span>
          <span v-if="privacyToggle" class="tag" :class="x.is_public ? '' : 'muted'" style="margin-left: 0.3rem">
            {{ x.is_public ? 'Público' : 'Privado' }}
          </span>
        </div>
      </div>
      <span class="amount">{{ formatEur(x.amount) }}</span>
      <div v-if="editable" class="actions">
        <button type="button" class="icon dots" title="Opciones" aria-label="Opciones" @click="menuFor = x">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </button>
      </div>
    </li>
  </ul>

  <Sheet v-if="menuFor" :title="titleOf(menuFor)" @close="menuFor = undefined">
    <div class="quick">
      <button type="button" @click="edit(menuFor)">
        <span>Editar gasto<small>Cambiar importe, fecha o categoría</small></span>
      </button>
      <button v-if="privacyToggle" type="button" @click="togglePublic(menuFor)">
        <span v-if="menuFor.is_public">Hacer privado<small>Tu pareja dejará de verlo</small></span>
        <span v-else>Hacer público<small>Tu pareja podrá verlo, solo lectura</small></span>
      </button>
      <button type="button" class="destructive" @click="remove(menuFor)">
        <span>Borrar gasto<small>No se puede deshacer</small></span>
      </button>
    </div>
  </Sheet>
</template>
