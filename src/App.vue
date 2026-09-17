<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSession } from './composables/useSession'
import { useData, type ExpenseInput } from './composables/useData'
import { useEditor } from './composables/useEditor'
import { useMonth } from './composables/useMonth'
import { useInsights } from './composables/useInsights'
import { online } from './lib/offline'
import { formatMonth, monthOf, todayIso } from './lib/money'
import QuickAdd from './components/QuickAdd.vue'
import ExpenseForm from './components/ExpenseForm.vue'
import PiggyAdvisor from './components/PiggyAdvisor.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import UiIcon from './components/UiIcon.vue'
import Logo from './components/Logo.vue'
import { installSwipe } from './lib/swipe'

const { state, partner, me } = useSession()
const data = useData()
const editor = useEditor()
const route = useRoute()
const router = useRouter()
const { month, shift, reset, isCurrent } = useMonth()

// El cerdito: botón discreto junto a Ajustes; el puntito sale si hay algo importante sin ver.
const piggy = useInsights()
const piggyOpen = ref(false)
function openPiggy() {
  piggyOpen.value = true
  piggy.markSeen()
}

const inApp = computed(() => !!state.user && !!state.household && !state.recovery)

// Deslizar: izquierda → Pareja, derecha → Yo (solo entre esas dos vistas).
let removeSwipe: (() => void) | null = null
onMounted(() => {
  removeSwipe = installSwipe((dir) => {
    if (!inApp.value || editor.state.formOpen || editor.state.quickOpen || piggyOpen.value) return
    if (dir === 'left' && route.name === 'personal') router.push({ name: 'couple' })
    if (dir === 'right' && route.name === 'couple') router.push({ name: 'personal' })
  })
})
onBeforeUnmount(() => removeSwipe?.())

// Al volver a la app (desbloquear el móvil, cambiar de pestaña) se recargan los
// datos si son de hace más de un minuto, y si ha cambiado el mes se vuelve al actual.
let shownMonth = monthOf(todayIso())
function onVisible() {
  if (document.visibilityState !== 'visible' || !inApp.value) return
  const now = monthOf(todayIso())
  if (now !== shownMonth) {
    // Si estaba mirando el mes que era el actual, pasa al nuevo mes actual
    if (month.value === shownMonth) reset()
    shownMonth = now
  }
  data.refreshIfStale()
}
onMounted(() => document.addEventListener('visibilitychange', onVisible))
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))

// Cuando vuelve la conexión se recarga enseguida (y se pasa de la copia local a lo real).
watch(online, (on) => { if (on && inApp.value) data.refreshIfStale(0) })
const offlineText = computed(() => {
  if (!online.value) return data.offline.value ? 'Sin conexión: ves la última copia guardada. No se puede guardar hasta que vuelva.' : 'Sin conexión: no se puede guardar hasta que vuelva.'
  if (data.offline.value) return 'Enseñando la última copia guardada; reconectando…'
  return ''
})

// Al llegar desde el email de recuperación, la app manda a "nueva contraseña".
watch(() => state.recovery, (r) => { if (r) router.push({ name: 'new-password' }) })
const showMonth = computed(() => inApp.value && (route.name === 'personal' || route.name === 'couple'))
const navAccent = computed(() => (route.name === 'couple' ? 'var(--pareja)' : 'var(--yo)'))

// El formulario se queda abierto hasta que el servidor confirma: si falla la
// red, no se pierde lo escrito y se puede volver a pulsar Guardar.
async function saveExpense(input: ExpenseInput) {
  const hid = state.household?.id
  if (!hid || editor.state.saving) return
  editor.state.saving = true
  try {
    await data.saveExpense(input)
    editor.state.saving = false
    editor.close()
    editor.toast(input.id ? 'Gasto actualizado' : 'Gasto guardado')
  } catch (e) {
    editor.state.saving = false
    editor.toast(`No se ha podido guardar: ${(e as Error).message}`)
  }
}
</script>

<template>
  <header class="topbar" :class="{ 'space-pareja': route.name === 'couple', 'space-yo': route.name !== 'couple' }">
    <div class="inner">
      <router-link class="brand" to="/"><Logo :size="26" /> Gas<span>Titos</span></router-link>
      <div v-if="inApp" class="topbar-actions">
        <button type="button" class="icon piggy-btn" :aria-label="piggy.hasNews.value ? 'El cerdito (tiene algo que contarte)' : 'El cerdito'" title="El cerdito" @click="openPiggy">
          <UiIcon name="pig" :size="22" />
          <span v-if="piggy.hasNews.value" class="piggy-dot" />
        </button>
        <router-link :to="{ name: 'settings' }" class="btn icon" aria-label="Ajustes" title="Ajustes"><UiIcon name="settings" /></router-link>
      </div>
    </div>
    <div v-if="showMonth" class="monthrow">
      <router-link :to="{ name: 'year' }" class="btn icon side" aria-label="Resumen del año" title="Resumen del año"><UiIcon name="calendar" :size="20" /></router-link>
      <button type="button" class="icon" aria-label="Mes anterior" @click="shift(-1)">‹</button>
      <button type="button" class="ghost month-label" :title="isCurrent() ? '' : 'Volver al mes actual'" @click="reset()">
        {{ formatMonth(month) }}<span v-if="!isCurrent()" class="tag" style="margin-left: 0.4rem">hoy</span>
      </button>
      <button type="button" class="icon" aria-label="Mes siguiente" @click="shift(1)">›</button>
      <router-link :to="{ name: 'search' }" class="btn icon side" aria-label="Buscar gastos" title="Buscar gastos"><UiIcon name="search" :size="20" /></router-link>
    </div>
  </header>

  <div v-if="inApp && offlineText" class="offline-bar" role="status">{{ offlineText }}</div>

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
    :busy="editor.state.saving"
    @save="saveExpense"
    @close="editor.close()"
  />

  <ConfirmDialog />
  <PiggyAdvisor v-if="piggyOpen" :insights="piggy.insights.value" :name="me?.display_name" @close="piggyOpen = false" />

  <div v-if="editor.state.toast" class="toast" role="status">{{ editor.state.toast }}</div>
</template>

<style>
.toast {
  position: fixed; left: 50%; bottom: calc(var(--nav-h) + 16px + env(safe-area-inset-bottom)); transform: translateX(-50%);
  background: var(--ink); color: var(--bg); padding: 0.6rem 1rem; border-radius: 999px; font-size: 0.9rem; font-weight: 600;
  box-shadow: var(--shadow); z-index: 60; max-width: calc(100% - 32px);
  /* El aviso no debe tapar los toques: lo de debajo sigue siendo pulsable. */
  pointer-events: none;
}
.topbar .btn.icon { text-decoration: none; }
.offline-bar { background: var(--warn-soft); color: var(--warn); font-size: 0.82rem; font-weight: 600; text-align: center; padding: 0.35rem 16px; }
.topbar-actions { display: flex; align-items: center; gap: 0.1rem; }
.piggy-btn { position: relative; }
.piggy-dot {
  position: absolute; top: 7px; right: 6px; width: 9px; height: 9px; border-radius: 50%;
  background: var(--neg); box-shadow: 0 0 0 2px var(--bg);
}
.brand { display: inline-flex; align-items: center; gap: 0.35rem; }
.monthrow { max-width: 680px; margin: 0 auto; padding: 0 8px 6px; display: flex; align-items: center; justify-content: center; gap: 0.25rem; }
.monthrow .side { color: var(--ink-3); }
.monthrow .side:first-child { margin-right: auto; }
.monthrow .side:last-child { margin-left: auto; }
.month-label { font-family: var(--font-display); font-weight: 600; font-size: 1rem; color: var(--ink); min-width: 170px; min-height: 40px; justify-content: center; }
.monthrow button.icon { font-size: 1.4rem; }
</style>
