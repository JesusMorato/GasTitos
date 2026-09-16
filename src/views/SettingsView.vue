<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../composables/useSession'
import { useData } from '../composables/useData'
import type { Category } from '../types'
import CategoryIcon from '../components/CategoryIcon.vue'
import Sheet from '../components/Sheet.vue'
import EmojiPicker from '../components/EmojiPicker.vue'

const router = useRouter()
const { state, me, partner, signOut, renameHousehold, renameMe, setMySplit } = useSession()
const data = useData()

onMounted(() => data.ensureLoaded())

const householdName = ref(state.household?.name ?? '')
const myName = ref(me.value?.display_name ?? '')
const myPct = ref<number>(Math.round(me.value?.share_pct ?? 50))
watch(me, (m) => {
  if (m) {
    myName.value = m.display_name
    myPct.value = Math.round(m.share_pct)
  }
})
const partnerPct = computed(() => 100 - Number(myPct.value || 0))

// --- límites mensuales ---
const myLimit = ref<number>(0)
const potLimit = ref<number>(0)
watch(
  () => [data.budgets.value, state.user?.id] as const,
  ([, uid]) => {
    myLimit.value = uid ? (data.myBudget(uid)?.monthly_limit ?? 0) : 0
    potLimit.value = data.potBudget.value?.monthly_limit ?? 0
  },
  { immediate: true, deep: true },
)

const msg = ref<string | null>(null)
const err = ref<string | null>(null)

async function run(fn: () => Promise<void>, okMsg: string) {
  msg.value = null
  err.value = null
  try {
    await fn()
    msg.value = okMsg
  } catch (e) {
    err.value = (e as Error).message
  }
}

// --- categorías ---
const catOpen = ref(false)
const catEditing = ref<Category | undefined>()
const catName = ref('')
const catEmoji = ref('📦')
const catColor = ref('#7a857f')
const catIcon = ref<string | null>(null)

function openCat(c?: Category) {
  catEditing.value = c
  catName.value = c?.name ?? ''
  catEmoji.value = c?.emoji ?? '📦'
  catColor.value = c?.color ?? '#7a857f'
  catIcon.value = c?.icon ?? null
  catOpen.value = true
}
function saveCat() {
  const input = { name: catName.value.trim(), emoji: catEmoji.value || '📦', color: catColor.value, icon: catIcon.value }
  if (!input.name) return
  const editing = catEditing.value
  catOpen.value = false
  run(() => (editing ? data.updateCategory(editing.id, input) : data.addCategory(state.household!.id, input)), 'Categoría guardada')
}
function deleteCat(c: Category) {
  if (confirm(`¿Borrar la categoría "${c.name}"?`)) run(() => data.deleteCategory(c.id), 'Categoría borrada')
}
function moveCat(c: Category, dir: -1 | 1) {
  const list = data.categories.value
  const i = list.findIndex((x) => x.id === c.id)
  const j = i + dir
  if (j < 0 || j >= list.length) return
  const other = list[j]
  run(async () => {
    await data.updateCategory(c.id, { sort_order: other.sort_order })
    await data.updateCategory(other.id, { sort_order: c.sort_order })
  }, 'Orden actualizado')
}

async function logout() {
  await signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="space-yo stack">
    <h1>Ajustes</h1>
    <p v-if="msg" class="ok">{{ msg }}</p>
    <p v-if="err" class="error">{{ err }}</p>

    <div class="card">
      <h2>Tú</h2>
      <div class="field" style="margin-top: 0.6rem">
        <label for="myname">Tu nombre (como te ve tu pareja)</label>
        <div class="row">
          <input id="myname" v-model="myName" maxlength="40" class="grow" />
          <button type="button" class="small" :disabled="!myName.trim() || myName.trim() === me?.display_name" @click="run(() => renameMe(myName), 'Nombre actualizado')">Guardar</button>
        </div>
      </div>
      <div class="tiny">Sesión: {{ state.user?.email }}</div>
    </div>

    <div class="card space-pareja">
      <h2>Hogar</h2>
      <div class="field" style="margin-top: 0.6rem">
        <label for="hname">Nombre del hogar</label>
        <div class="row">
          <input id="hname" v-model="householdName" maxlength="60" class="grow" />
          <button type="button" class="small" :disabled="!householdName.trim() || householdName.trim() === state.household?.name" @click="run(() => renameHousehold(householdName), 'Hogar renombrado')">Guardar</button>
        </div>
      </div>

      <div v-if="!partner" class="field">
        <label>Código de invitación</label>
        <div class="code-invite">{{ state.household?.invite_code }}</div>
        <p class="help">Pásaselo a tu pareja: en su primera entrada elegirá "Unirme con código".</p>
      </div>

      <div class="field">
        <label for="pct">Reparto por defecto de los gastos repartidos</label>
        <div class="row" style="margin-bottom: 0.3rem">
          <span class="grow"><strong>{{ me?.display_name ?? 'Tú' }}</strong> {{ myPct }} %</span>
          <span class="grow right"><strong>{{ partner?.display_name ?? 'Tu pareja' }}</strong> {{ partnerPct }} %</span>
        </div>
        <input id="pct" v-model.number="myPct" type="range" min="0" max="100" step="5" style="padding: 0" />
        <div class="row" style="margin-top: 0.5rem">
          <button type="button" class="small" :disabled="Math.round(me?.share_pct ?? 50) === myPct" @click="run(() => setMySplit(myPct), 'Reparto actualizado')">Guardar reparto</button>
          <button type="button" class="ghost small" @click="myPct = 50">50/50</button>
        </div>
        <p class="help">Es el reparto que se propone al apuntar un gasto repartido. Cada gasto puede cambiarlo.</p>
      </div>
    </div>

    <div class="card">
      <h2>Límites mensuales</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">Orientativos: no bloquean nada, solo avisan cuando vas rápido o te pasas. Se ven en "Mi mes" y en Pareja → Bote.</p>
      <div class="grid2">
        <div class="field">
          <label for="mylimit">Mi límite (personal + mi parte)</label>
          <div class="row">
            <input id="mylimit" v-model.number="myLimit" type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" class="grow" />
            <button type="button" class="small" :disabled="(myLimit || null) === (data.myBudget(state.user!.id)?.monthly_limit ?? null)" @click="run(() => data.setBudget('personal', myLimit > 0 ? myLimit : null), 'Límite guardado')">Guardar</button>
          </div>
        </div>
        <div class="field space-pareja">
          <label for="potlimit">Límite del bote (común)</label>
          <div class="row">
            <input id="potlimit" v-model.number="potLimit" type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" class="grow" />
            <button type="button" class="small" :disabled="(potLimit || null) === (data.potBudget.value?.monthly_limit ?? null)" @click="run(() => data.setBudget('pot', potLimit > 0 ? potLimit : null), 'Límite del bote guardado')">Guardar</button>
          </div>
        </div>
      </div>
      <p class="help">Deja el campo a 0 o vacío y guarda para quitar un límite.</p>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Categorías</h2>
        <button type="button" class="small secondary" @click="openCat()">+ Nueva</button>
      </div>
      <p class="tiny" style="margin-bottom: 0.4rem">Son comunes al hogar. Elige para cada una un icono GasTitos o un emoji, y su color.</p>
      <ul class="list">
        <li v-for="(c, i) in data.categories.value" :key="c.id">
          <CategoryIcon :icon="c.icon" :emoji="c.emoji" :color="c.color" />
          <div class="grow ellipsis"><strong>{{ c.name }}</strong></div>
          <div class="actions">
            <button type="button" class="icon" title="Subir" :disabled="i === 0" @click="moveCat(c, -1)">↑</button>
            <button type="button" class="icon" title="Bajar" :disabled="i === data.categories.value.length - 1" @click="moveCat(c, 1)">↓</button>
            <button type="button" class="icon" title="Editar" @click="openCat(c)">✏️</button>
            <button type="button" class="icon" title="Borrar" @click="deleteCat(c)">🗑️</button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card flat">
      <button type="button" class="danger small" @click="logout">Cerrar sesión</button>
    </div>

    <Sheet v-if="catOpen" :title="catEditing ? 'Editar categoría' : 'Nueva categoría'" @close="catOpen = false">
      <form @submit.prevent="saveCat">
        <div class="field">
          <label for="cname">Nombre</label>
          <input id="cname" v-model="catName" required maxlength="30" placeholder="Mascotas" />
        </div>
        <EmojiPicker v-model:emoji="catEmoji" v-model:color="catColor" v-model:icon="catIcon" icons />
        <div class="row" style="justify-content: flex-end">
          <button type="button" class="ghost" @click="catOpen = false">Cancelar</button>
          <button type="submit">Guardar</button>
        </div>
      </form>
    </Sheet>
  </div>
</template>
