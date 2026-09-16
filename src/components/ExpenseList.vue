<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { Category, Expense } from '../types'
import { describeSplit, formatDate, formatEur, type Share } from '../lib/money'
import CategoryIcon from './CategoryIcon.vue'
import { vMarquee } from '../lib/marquee'

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

// Id del gasto cuyo menú de tres puntos está abierto ('' = ninguno).
const menuId = ref('')
// Si no cabe por debajo del botón, el menú se abre hacia arriba.
const menuUp = ref(false)

const MENU_ALTO = 170 // altura aproximada del menú con sus tres opciones
const NAV_ALTO = 64 // barra de navegación inferior

function toggleMenu(x: Row, ev: MouseEvent) {
  if (menuId.value === x.id) {
    menuId.value = ''
    return
  }
  const boton = (ev.currentTarget as HTMLElement).getBoundingClientRect()
  menuUp.value = boton.bottom + MENU_ALTO > window.innerHeight - NAV_ALTO
  menuId.value = x.id
}

function closeMenu() {
  menuId.value = ''
}

function edit(x: Row) {
  closeMenu()
  emit('edit', x)
}

function remove(x: Row) {
  closeMenu()
  emit('delete', x)
}

function togglePublic(x: Row) {
  closeMenu()
  emit('toggle-public', x)
}

// El menú se cierra al tocar fuera de él o al pulsar Escape.
function onPointerDown(ev: PointerEvent) {
  if (!menuId.value) return
  const target = ev.target as HTMLElement | null
  if (!target?.closest('.actions')) closeMenu()
}

function onKeyDown(ev: KeyboardEvent) {
  if (ev.key === 'Escape') closeMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div v-if="expenses.length === 0" class="empty">{{ emptyText ?? 'Nada por aquí todavía.' }}</div>
  <ul v-else class="list">
    <li v-for="x in expenses" :key="x.id">
      <CategoryIcon
        :icon="categoryById[x.category_id]?.icon"
        :emoji="categoryById[x.category_id]?.emoji"
        :color="categoryById[x.category_id]?.color"
      />
      <div class="grow">
        <div v-marquee class="ellipsis marquee">
          <span class="marquee-inner"><strong>{{ x.description || categoryById[x.category_id]?.name || 'Gasto' }}</strong><span v-if="x.description" class="muted"> · {{ categoryById[x.category_id]?.name }}</span></span>
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
        <button
          type="button"
          class="icon dots"
          title="Opciones"
          aria-label="Opciones"
          aria-haspopup="menu"
          :aria-expanded="menuId === x.id"
          @click="toggleMenu(x, $event)"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </button>
        <div v-if="menuId === x.id" class="menu" :class="{ up: menuUp }" role="menu">
          <button type="button" role="menuitem" @click="edit(x)">Editar</button>
          <button v-if="privacyToggle" type="button" role="menuitem" @click="togglePublic(x)">
            {{ x.is_public ? 'Hacer privado' : 'Hacer público' }}
          </button>
          <button type="button" role="menuitem" class="destructive" @click="remove(x)">Borrar</button>
        </div>
      </div>
    </li>
  </ul>
</template>
