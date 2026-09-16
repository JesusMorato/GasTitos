<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from './composables/useSession'
import { useData, type ExpenseInput } from './composables/useData'
import { useEditor } from './composables/useEditor'
import { useMonth } from './composables/useMonth'
import { formatMonth } from './lib/money'
import QuickAdd from './components/QuickAdd.vue'
import ExpenseForm from './components/ExpenseForm.vue'
import UiIcon from './components/UiIcon.vue'
import Logo from './components/Logo.vue'
import { installSwipe } from './lib/swipe'

const { state, partner } = useSession()
const data = useData()
const editor = useEditor()
const route = useRoute()
const router = useRouter()
const { month, shift, reset, isCurrent } = useMonth()

const inApp = computed(() => !!state.user && !!state.household && !state.recovery)

// Deslizar: izquierda → Pareja, derecha → Yo (solo entre esas dos vistas).
let removeSwipe: (() => void) | null = null
onMounted(() => {
  removeSwipe = installSwipe((dir) => {
    if (!inApp.value || editor.state.formOpen || editor.state.quickOpen) return
    if (dir === 'left' && route.name === 'personal') router.push({ name: 'couple' })
    if (dir === 'right' && route.name === 'couple') router.push({ name: 'personal' })
  })
})
onBeforeUnmount(() => removeSwipe?.())

// Al llegar desde el email de recuperación, la app manda a "nueva contraseña".
watch(() => state.recovery, (r) => { if (r) router.push({ name: 'new-password' }) })
const showMonth = computed(() => inApp.value && (route.name === 'personal' || route.name === 'couple'))
const navAccent = computed(() => (route.name === 'couple' ? 'var(--pareja)' : 'var(--yo)'))

async function saveExpense(input: ExpenseInput) {
  const hid = state.household?.id
  if (!hid) return
  editor.close()
  try {
    await data.saveExpense(input)
    editor.toast(input.id ? 'Gasto actualizado' : 'Gasto guardado')
  } catch (e) {
    editor.toast((e as Error).message)
  }
}
</script>

<template>
  <header class="topbar" :class="{ 'space-pareja': route.name === 'couple', 'space-yo': route.name !== 'couple' }">
    <div class="inner">
      <router-link class="brand" to="/"><Logo :size="26" /> Gas<span>Titos</span></router-link>
      <router-link v-if="inApp" :to="{ name: 'settings' }" class="btn icon" aria-label="Ajustes" title="Ajustes"><UiIcon name="settings" /></router-link>
    </div>
    <div v-if="showMonth" class="monthrow">
      <button type="button" class="icon" aria-label="Mes anterior" @click="shift(-1)">‹</button>
      <button type="button" class="ghost month-label" :title="isCurrent() ? '' : 'Volver al mes actual'" @click="reset()">
        {{ formatMonth(month) }}<span v-if="!isCurrent()" class="tag" style="margin-left: 0.4rem">hoy</span>
      </button>
      <button type="button" class="icon" aria-label="Mes siguiente" @click="shift(1)">›</button>
    </div>
  </header>

  <main class="container grow">
    <p v-if="!state.ready" class="muted">Cargando…</p>
    <router-view v-else />
  </main>

  <nav v-if="inApp" class="bottomnav" :style="{ '--nav-accent': navAccent }">
    <div class="inner">
      <router-link :to="{ name: 'personal' }">
        <UiIcon name="user" :size="24" />
        Yo
      </router-link>
      <button type="button" class="fab" aria-label="Añadir gasto" :style="{ '--accent': navAccent }" @click="editor.openQuick()">+</button>
      <router-link :to="{ name: 'couple' }">
        <UiIcon name="users" :size="24" />
        Pareja
      </router-link>
    </div>
  </nav>

  <QuickAdd v-if="editor.state.quickOpen" :has-partner="!!partner" @pick="editor.openNew" @close="editor.close()" />
  <ExpenseForm
    v-if="editor.state.formOpen && state.user"
    :preset="editor.state.preset"
    :members="state.members"
    :categories="data.categories.value"
    :current-user-id="state.user.id"
    :initial="editor.state.editing"
    @save="saveExpense"
    @close="editor.close()"
  />

  <div v-if="editor.state.toast" class="toast" role="status">{{ editor.state.toast }}</div>
</template>

<style>
.toast {
  position: fixed; left: 50%; bottom: calc(var(--nav-h) + 16px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  background: var(--ink); color: var(--bg); padding: 0.6rem 1rem; border-radius: 999px; font-size: 0.9rem; font-weight: 600;
  box-shadow: var(--shadow); z-index: 60; max-width: calc(100% - 32px);
}
.topbar .btn.icon { text-decoration: none; }
.brand { display: inline-flex; align-items: center; gap: 0.35rem; }
.monthrow { max-width: 680px; margin: 0 auto; padding: 0 8px 6px; display: flex; align-items: center; justify-content: center; gap: 0.25rem; }
.month-label { font-family: var(--font-display); font-weight: 600; font-size: 1rem; color: var(--ink); min-width: 170px; justify-content: center; }
</style>
