<script setup lang="ts">
import type { Category, Expense } from '../types'
import { describeSplit, formatDate, formatEur, type Share } from '../lib/money'

type Row = Expense & { shares: Share[] }

defineProps<{
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
        <button v-if="privacyToggle" type="button" class="icon" :title="x.is_public ? 'Hacer privado' : 'Hacer público'" @click="emit('toggle-public', x)">
          {{ x.is_public ? '🔓' : '🔒' }}
        </button>
        <button type="button" class="icon" title="Editar" @click="emit('edit', x)">✏️</button>
        <button type="button" class="icon" title="Borrar" @click="emit('delete', x)">🗑️</button>
      </div>
    </li>
  </ul>
</template>
