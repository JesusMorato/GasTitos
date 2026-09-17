<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../composables/useSession'
import { useData, type RecurringInput } from '../composables/useData'
import { useConfirm } from '../composables/useConfirm'
import type { Category, RecurringExpense } from '../types'
import { todayIso } from '../lib/money'
import { downloadText, toCsv } from '../lib/csv'
import CategoryIcon from '../components/CategoryIcon.vue'
import Sheet from '../components/Sheet.vue'
import EmojiPicker from '../components/EmojiPicker.vue'
import RecurringForm from '../components/RecurringForm.vue'
import RecurringList from '../components/RecurringList.vue'
import UiIcon from '../components/UiIcon.vue'

const router = useRouter()
const { state, me, partner, nameOf, signOut, renameHousehold, renameMe, setMySplit } = useSession()
const data = useData()
const { confirm } = useConfirm()

onMounted(() => data.ensureLoaded(state.user?.id))

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
    if (okMsg) msg.value = okMsg
  } catch (e) {
    err.value = (e as Error).message
  }
}

// --- gastos fijos ---
const recOpen = ref(false)
const recEditing = ref<RecurringExpense | undefined>()
function openRec(r?: RecurringExpense) {
  recEditing.value = r
  recOpen.value = true
}
function saveRec(input: RecurringInput) {
  const editing = recEditing.value
  recOpen.value = false
  run(() => (editing ? data.updateRecurring(editing.id, input) : data.addRecurring(state.household!.id, input)), 'Gasto fijo guardado')
}
function toggleRec(r: RecurringExpense) {
  run(() => data.updateRecurring(r.id, { active: !r.active }), r.active ? 'Gasto fijo pausado' : 'Gasto fijo activado')
}
async function deleteRec(r: RecurringExpense) {
  if (await confirm({ title: 'Borrar gasto fijo', message: `Se borra "${r.name}". Los gastos que ya se apuntaron se quedan.` })) run(() => data.deleteRecurring(r.id), 'Gasto fijo borrado')
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
  moveTo.value = ''
  catOpen.value = true
}
function saveCat() {
  const input = { name: catName.value.trim(), emoji: catEmoji.value || '📦', color: catColor.value, icon: catIcon.value }
  if (!input.name) return
  const editing = catEditing.value
  catOpen.value = false
  run(() => (editing ? data.updateCategory(editing.id, input) : data.addCategory(state.household!.id, input)), 'Categoría guardada')
}
async function deleteCat(c: Category) {
  const used = data.expenses.value.some((e) => e.category_id === c.id) || data.recurring.value.some((r) => r.category_id === c.id)
  if (used) {
    // Con gastos no se puede borrar a secas: se abre la hoja para moverlos primero.
    openCat(c)
    return
  }
  if (await confirm({ title: 'Borrar categoría', message: `¿Borrar la categoría "${c.name}"?` })) run(() => data.deleteCategory(c.id), 'Categoría borrada')
}
// Mover en bloque los gastos de la categoría que se está editando a otra
const moveTo = ref('')
const catUsage = computed(() => {
  const id = catEditing.value?.id
  if (!id) return 0
  return data.expenses.value.filter((e) => e.category_id === id).length + data.recurring.value.filter((r) => r.category_id === id).length
})
const otherCats = computed(() => data.categories.value.filter((c) => c.id !== catEditing.value?.id))
async function moveAll(del: boolean) {
  const from = catEditing.value
  const to = data.categoryById.value[moveTo.value]
  if (!from || !to) return
  const ok = await confirm({
    title: del ? 'Mover y borrar' : 'Mover gastos',
    message: del
      ? `Todos los gastos de "${from.name}" pasan a "${to.name}" y "${from.name}" se borra.`
      : `Todos los gastos de "${from.name}" (también los de tu pareja) pasan a "${to.name}".`,
    confirmLabel: del ? 'Mover y borrar' : 'Mover',
    danger: del,
  })
  if (!ok) return
  catOpen.value = false
  run(async () => {
    const n = await data.moveCategory(from.id, to.id, del)
    msg.value = `${n} ${n === 1 ? 'gasto movido' : 'gastos movidos'} a "${to.name}"${del ? ' y categoría borrada' : ''}`
  }, '')
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
  data.reset()
  router.push({ name: 'login' })
}

// --- exportar ---
function kindOfExpense(e: { is_shared: boolean; funding: string }) {
  return !e.is_shared ? 'personal' : e.funding === 'pot' ? 'conjunta' : 'repartido'
}
function exportExpenses() {
  const uid = state.user!.id
  const rows: unknown[][] = [['Fecha', 'Tipo', 'Categoría', 'Nota', 'Importe', 'Pagado por', 'Mi parte', 'Parte de mi pareja', 'Público', 'Gasto fijo']]
  for (const e of [...data.expensesWithShares.value].sort((a, b) => (a.spent_on < b.spent_on ? -1 : 1))) {
    const mine = e.shares.find((s) => s.user_id === uid)?.amount ?? null
    const theirs = e.shares.find((s) => s.user_id !== uid)?.amount ?? null
    rows.push([
      e.spent_on, kindOfExpense(e), data.categoryById.value[e.category_id]?.name ?? '', e.description ?? '', e.amount,
      e.funding === 'pot' ? 'cuenta conjunta' : nameOf(e.user_id), mine, theirs, e.is_public ? 'sí' : 'no', e.recurring_id ? 'sí' : 'no',
    ])
  }
  rows.push([])
  rows.push(['Pagos entre vosotros'])
  rows.push(['Fecha', 'De', 'A', 'Importe', 'Nota'])
  for (const s of [...data.settlements.value].sort((a, b) => (a.settled_on < b.settled_on ? -1 : 1))) {
    rows.push([s.settled_on, nameOf(s.from_user), nameOf(s.to_user), s.amount, s.note ?? ''])
  }
  downloadText(`gastitos-gastos-${todayIso()}.csv`, toCsv(rows))
}
function exportGoals() {
  const rows: unknown[][] = [['Hucha', 'Tipo', 'Objetivo', 'Fecha límite', 'Ahorrado', 'Fecha', 'Quién', 'Movimiento', 'Importe', 'Nota']]
  for (const g of data.goals.value) {
    const moves = data.contributions.value.filter((c) => c.goal_id === g.id).sort((a, b) => (a.contributed_on < b.contributed_on ? -1 : 1))
    const saved = data.savedByGoal.value[g.id] ?? 0
    if (moves.length === 0) rows.push([g.name, g.is_shared ? 'pareja' : 'personal', g.target_amount, g.deadline ?? '', saved, '', '', '', '', ''])
    for (const c of moves) {
      rows.push([g.name, g.is_shared ? 'pareja' : 'personal', g.target_amount, g.deadline ?? '', saved, c.contributed_on, nameOf(c.user_id), c.direction === 'out' ? 'sacar' : 'meter', c.amount, c.note ?? ''])
    }
  }
  downloadText(`gastitos-huchas-${todayIso()}.csv`, toCsv(rows))
}
</script>

<template>
  <div class="space-yo stack">
    <h1>Ajustes</h1>
    <p v-if="msg" class="ok">{{ msg }}</p>
    <p v-if="err" class="error">{{ err }}</p>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Gastos fijos</h2>
        <button type="button" class="small secondary" @click="openRec()">+ Nuevo</button>
      </div>
      <p class="tiny" style="margin-bottom: 0.4rem">Al entrar en un mes nuevo se apuntan solos. Los de importe variable quedan pendientes hasta que pongas la cifra.</p>
      <RecurringList
        :items="data.recurring.value"
        :category-by-id="data.categoryById.value"
        :name-of="nameOf"
        show-kind
        empty-text="Aún no hay gastos fijos. Empieza por el alquiler."
        @toggle="toggleRec"
        @edit="openRec"
        @delete="deleteRec"
      />
    </div>

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
        <p class="help">Es el reparto que se propone al apuntar un gasto repartido, y el que se usa para tu parte de la cuenta conjunta en "Mi mes".</p>
      </div>
    </div>

    <div class="card">
      <h2>Límites mensuales</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">Orientativos: no bloquean nada, solo avisan cuando vas rápido o te pasas. Se ven en "Mi mes" y en Pareja → Conjunta.</p>
      <div class="grid2">
        <div class="field">
          <label for="mylimit">Mi límite (personal + repartido + conjunta)</label>
          <div class="row">
            <input id="mylimit" v-model.number="myLimit" type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" class="grow" />
            <button type="button" class="small" :disabled="(myLimit || null) === (data.myBudget(state.user!.id)?.monthly_limit ?? null)" @click="run(() => data.setBudget('personal', myLimit > 0 ? myLimit : null), 'Límite guardado')">Guardar</button>
          </div>
        </div>
        <div class="field space-pareja">
          <label for="potlimit">Límite de la cuenta conjunta (común)</label>
          <div class="row">
            <input id="potlimit" v-model.number="potLimit" type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" class="grow" />
            <button type="button" class="small" :disabled="(potLimit || null) === (data.potBudget.value?.monthly_limit ?? null)" @click="run(() => data.setBudget('pot', potLimit > 0 ? potLimit : null), 'Límite de la cuenta conjunta guardado')">Guardar</button>
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
            <button type="button" class="icon" title="Subir" aria-label="Subir" :disabled="i === 0" @click="moveCat(c, -1)"><UiIcon name="chevronUp" :size="18" /></button>
            <button type="button" class="icon" title="Bajar" aria-label="Bajar" :disabled="i === data.categories.value.length - 1" @click="moveCat(c, 1)"><UiIcon name="chevronDown" :size="18" /></button>
            <button type="button" class="icon" title="Editar" aria-label="Editar" @click="openCat(c)"><UiIcon name="pencil" :size="18" /></button>
            <button type="button" class="icon" title="Borrar" aria-label="Borrar" @click="deleteCat(c)"><UiIcon name="trash" :size="18" /></button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2>Tus datos</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">Descarga una copia en CSV (se abre en Excel). Incluye lo que tú puedes ver: lo tuyo, lo repartido y la cuenta conjunta.</p>
      <div class="row">
        <button type="button" class="secondary small" @click="exportExpenses"><UiIcon name="arrowIn" :size="16" /> Gastos y pagos</button>
        <button type="button" class="secondary small" @click="exportGoals"><UiIcon name="arrowIn" :size="16" /> Huchas y movimientos</button>
      </div>
    </div>

    <div class="card flat">
      <button type="button" class="danger small" @click="logout">Cerrar sesión</button>
    </div>

    <RecurringForm
      v-if="recOpen && state.user"
      :members="state.members"
      :categories="data.categories.value"
      :current-user-id="state.user.id"
      :initial="recEditing"
      @save="saveRec"
      @close="recOpen = false"
    />

    <Sheet v-if="catOpen" :title="catEditing ? 'Editar categoría' : 'Nueva categoría'" @close="catOpen = false">
      <form @submit.prevent="saveCat">
        <div class="field">
          <label for="cname">Nombre</label>
          <input id="cname" v-model="catName" required maxlength="30" placeholder="Mascotas" />
        </div>
        <EmojiPicker v-model:emoji="catEmoji" v-model:color="catColor" v-model:icon="catIcon" icons @pick-icon="(i) => { if (!catName.trim()) catName = i.name }" />
        <div class="row" style="justify-content: flex-end">
          <button type="button" class="ghost" @click="catOpen = false">Cancelar</button>
          <button type="submit">Guardar</button>
        </div>
      </form>

      <template v-if="catEditing && otherCats.length">
        <hr class="sep" />
        <div class="field">
          <label for="moveto">Mover sus gastos a otra categoría</label>
          <p class="tiny" style="margin: 0 0 0.4rem">
            <template v-if="catUsage">Tiene {{ catUsage }} {{ catUsage === 1 ? 'gasto' : 'gastos' }} (contando fijos y los que ves de tu pareja).</template>
            <template v-else>No tiene gastos que tú veas; los privados de tu pareja también se moverían.</template>
          </p>
          <select id="moveto" v-model="moveTo">
            <option value="" disabled>Elige la categoría de destino…</option>
            <option v-for="c in otherCats" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="row">
          <button type="button" class="secondary small" :disabled="!moveTo" @click="moveAll(false)">Mover todos</button>
          <button type="button" class="danger small" :disabled="!moveTo" @click="moveAll(true)">Mover y borrar categoría</button>
        </div>
      </template>
    </Sheet>
  </div>
</template>
