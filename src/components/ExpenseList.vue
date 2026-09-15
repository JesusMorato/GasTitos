<script setup lang="ts">
import type { Expense } from '../types'
import { formatDate, formatEur } from '../lib/money'

defineProps<{
  expenses: Expense[]
  nameOf: (id: string) => string
  /** true si el usuario puede editar/borrar estos gastos */
  editable: boolean
  /** true para mostrar el botón público/privado (solo gastos individuales propios) */
  privacyToggle?: boolean
  showPayer?: boolean
}>()

const emit = defineEmits<{
  (e: 'edit', x: Expense): void
  (e: 'delete', x: Expense): void
  (e: 'toggle-public', x: Expense): void
}>()
</script>

<template>
  <p v-if="expenses.length === 0" class="muted">No hay gastos este mes.</p>
  <ul v-else class="list">
    <li v-for="x in expenses" :key="x.id">
      <div class="grow">
        <div>
          <strong>{{ x.category }}</strong>
          <span v-if="x.description" class="muted"> · {{ x.description }}</span>
        </div>
        <div class="muted">
          {{ formatDate(x.spent_on) }}
          <span v-if="showPayer"> · pagó {{ nameOf(x.user_id) }}</span>
          <span v-if="privacyToggle" class="tag" :class="x.is_public ? '' : 'muted'" style="margin-left: .4rem">
            {{ x.is_public ? 'Público' : 'Privado' }}
          </span>
        </div>
      </div>
      <span class="amount">{{ formatEur(x.amount) }}</span>
      <div v-if="editable" class="row" style="gap: .1rem">
        <button v-if="privacyToggle" class="ghost small" :title="x.is_public ? 'Hacer privado' : 'Hacer público'" @click="emit('toggle-public', x)">
          {{ x.is_public ? '🔓' : '🔒' }}
        </button>
        <button class="ghost small" title="Editar" @click="emit('edit', x)">✏️</button>
        <button class="ghost small" title="Borrar" @click="emit('delete', x)">🗑️</button>
      </div>
    </li>
  </ul>
</template>
