<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useSession } from './composables/useSession'
import { useData, type ExpenseInput } from './composables/useData'
import { useEditor } from './composables/useEditor'
import QuickAdd from './components/QuickAdd.vue'
import ExpenseForm from './components/ExpenseForm.vue'

const { state, partner } = useSession()
const data = useData()
const editor = useEditor()
const route = useRoute()

const inApp = computed(() => !!state.user && !!state.household)
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
  <header class="topbar">
    <div class="inner">
      <router-link class="brand" to="/">Gas<span>Titos</span></router-link>
      <router-link v-if="inApp" :to="{ name: 'settings' }" class="btn icon" aria-label="Ajustes" title="Ajustes">⚙️</router-link>
    </div>
  </header>

  <main class="container grow">
    <p v-if="!state.ready" class="muted">Cargando…</p>
    <router-view v-else />
  </main>

  <nav v-if="inApp" class="bottomnav" :style="{ '--nav-accent': navAccent }">
    <div class="inner">
      <router-link :to="{ name: 'personal' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        Yo
      </router-link>
      <button type="button" class="fab" aria-label="Añadir gasto" :style="{ '--accent': navAccent }" @click="editor.openQuick()">+</button>
      <router-link :to="{ name: 'couple' }">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3.5"/><circle cx="16.5" cy="9" r="3"/><path d="M2.5 20c0-3.3 2.5-6 5.5-6s5.5 2.7 5.5 6"/><path d="M13 20c0-2.8 1.8-5 3.8-5S21 17.2 21 20"/></svg>
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
</style>
