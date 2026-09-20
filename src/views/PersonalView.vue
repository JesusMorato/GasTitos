<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../composables/useSession'
import { useData, type GoalInput } from '../composables/useData'
import { useEditor, type ExpenseRow } from '../composables/useEditor'
import { useMonth } from '../composables/useMonth'
import { useConfirm } from '../composables/useConfirm'
import { computeShares, formatEur, lastMonths, localIso, monthOf, myShareTotal, round2, shortMonth, sum, totalsByMonth } from '../lib/money'
import { myItems } from '../lib/insights'
import { breakdownBy } from '../lib/breakdown'
import type { Contribution, DetectedPayment, PaymentKind, SavingsGoal } from '../types'
import ExpenseList from '../components/ExpenseList.vue'
import EmptyState from '../components/EmptyState.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'
import DonutChart from '../components/DonutChart.vue'
import CategoryBreakdown from '../components/CategoryBreakdown.vue'
import MonthlyBars from '../components/MonthlyBars.vue'
import BudgetCard from '../components/BudgetCard.vue'
import PendingRecurring from '../components/PendingRecurring.vue'
import DetectedPayments from '../components/DetectedPayments.vue'
import UiIcon from '../components/UiIcon.vue'

const { state, me, partner, nameOf } = useSession()
const data = useData()
const editor = useEditor()
const { month } = useMonth()
const { confirm } = useConfirm()
const router = useRouter()

const showGoalForm = ref(false)
const editingGoal = ref<SavingsGoal | undefined>()
const actionError = ref<string | null>(null)

onMounted(() => data.ensureLoaded(state.user?.id))

const userId = computed(() => state.user!.id)
const myPct = computed(() => (me.value?.share_pct ?? 50) / 100)
const rows = computed<ExpenseRow[]>(() => data.expensesWithShares.value)
const monthRows = computed(() => rows.value.filter((e) => monthOf(e.spent_on) === month.value))

// "Lo mío" (ver lib/insights.ts): es el agregado que usan la cifra del mes, el donut,
// el límite y las barras, y también el cerdito.
const myItemsAll = computed(() => myItems(rows.value, userId.value, myPct.value))
const myItemsMonth = computed(() => myItemsAll.value.filter((x) => monthOf(x.spent_on) === month.value))

const myExpenses = computed(() => monthRows.value.filter((e) => !e.is_shared && e.user_id === userId.value))
const totalPersonal = computed(() => sum(myExpenses.value.map((e) => e.amount)))
const myShare = computed(() => myShareTotal(monthRows.value, userId.value))
const myPot = computed(() => round2(sum(monthRows.value.filter((e) => e.is_shared && e.funding === 'pot').map((e) => e.amount)) * myPct.value))
const totalMonth = computed(() => round2(totalPersonal.value + myShare.value + myPot.value))
const fixedCount = computed(() => myExpenses.value.filter((e) => e.recurring_id).length)

// Por categoría, con los gastos que componen cada una (se despliegan al pulsar).
const byCategory = computed(() =>
  breakdownBy(
    myItemsMonth.value.map((x) => ({
      key: x.category_id,
      id: x.id,
      label: x.description || data.categoryById.value[x.category_id]?.name || 'Gasto',
      date: x.spent_on,
      amount: x.amount,
      note:
        x.origin === 'shared' ? `tu parte de ${formatEur(x.full_amount)}`
        : x.origin === 'pot' ? `tu ${Math.round(myPct.value * 100)} % de ${formatEur(x.full_amount)}`
        : undefined,
    })),
  ),
)
const donutItems = computed(() =>
  byCategory.value.map((c) => ({
    label: data.categoryById.value[c.key]?.name ?? 'Otros',
    value: c.total,
    color: data.categoryById.value[c.key]?.color ?? '#7a857f',
  })),
)
// Categoría desplegada: la comparten la leyenda y el trozo resaltado del donut.
const openCat = ref<string | null>(null)
const selectedIdx = computed(() => {
  const i = byCategory.value.findIndex((c) => c.key === openCat.value)
  return i < 0 ? null : i
})
function selectSlice(i: number | null) {
  openCat.value = i === null ? null : (byCategory.value[i]?.key ?? null)
}

const months6 = computed(() => lastMonths(month.value, 6))
const bars6 = computed(() => [{ label: 'Gastado', values: totalsByMonth(myItemsAll.value, months6.value) }])
const labels6 = computed(() => months6.value.map(shortMonth))

const myLimit = computed(() => data.myBudget(userId.value)?.monthly_limit ?? null)
const myPending = computed(() => data.pendingRuns.value.filter((p) => p.recurring.kind === 'personal'))

const myGoals = computed(() => data.goals.value.filter((g) => !g.is_shared && g.user_id === userId.value))
const totalSaved = computed(() => sum(myGoals.value.map((g) => data.savedByGoal.value[g.id] ?? 0)))

function contributionsOf(goalId: string): Contribution[] {
  return data.contributions.value.filter((c) => c.goal_id === goalId)
}

async function run(fn: () => Promise<void>) {
  actionError.value = null
  try {
    await fn()
  } catch (e) {
    actionError.value = (e as Error).message
  }
}

// --- pagos detectados ---
// Si el comercio ya se apuntó otra vez, se repite su categoría y se guarda directo
// (Repartido solo si aquella vez fue con el reparto normal del hogar). Si no, se abre
// el formulario ya relleno.
const paymentBusy = ref<string | null>(null)
function pickPayment(p: DetectedPayment, kind: PaymentKind) {
  const memory = data.memoryFor(p.merchant)
  const category = memory?.category_id
  const base = { amount: p.amount, spent_on: localIso(new Date(p.paid_at)), description: p.merchant || null }
  const directShared = kind === 'shared' && memory?.split_mode === 'household' && state.members.length === 2
  if (category && (kind !== 'shared' || directShared)) {
    paymentBusy.value = p.id
    run(async () => {
      try {
        const input = kind === 'shared'
          ? { ...base, category_id: category, is_shared: true, funding: 'personal' as const, split_mode: 'household' as const, paid_by: userId.value, shares: computeShares(p.amount, 'household', state.members, userId.value) }
          : { ...base, category_id: category, is_shared: kind === 'pot', funding: kind === 'pot' ? 'pot' as const : 'personal' as const, split_mode: 'household' as const }
        await data.registerPayment(p.id, input)
        editor.toast('Gasto apuntado')
      } finally {
        paymentBusy.value = null
      }
    })
    return
  }
  editor.openNew(kind, { prefill: { ...base, description: base.description ?? undefined, category_id: category ?? undefined }, fromPayment: p.id })
}
async function dismissPayment(p: DetectedPayment) {
  paymentBusy.value = p.id
  try {
    await run(() => data.dismissPayment(p.id))
  } finally {
    paymentBusy.value = null
  }
  editor.toast('Pago descartado', { label: 'Deshacer', run: () => run(() => data.restorePayment(p.id)) })
}

function setLimit(v: number | null) {
  run(() => data.setBudget('personal', v))
}
async function deleteExpense(x: ExpenseRow) {
  if (!(await confirm({ title: 'Borrar gasto', message: `¿Borrar el gasto de ${formatEur(x.amount)}?` }))) return
  await run(() => data.deleteExpense(x.id))
  editor.toast('Gasto borrado', { label: 'Deshacer', run: () => run(() => data.reinsertExpense(x)) })
}
function togglePublic(x: ExpenseRow) {
  run(() => data.setExpensePublic(x.id, !x.is_public))
}

function saveGoal(input: GoalInput) {
  const editing = editingGoal.value
  showGoalForm.value = false
  editingGoal.value = undefined
  run(() => (editing ? data.updateGoal(editing.id, input) : data.addGoal(state.household!.id, userId.value, input)))
}
function editGoal(g: SavingsGoal) {
  editingGoal.value = g
  showGoalForm.value = true
}
async function deleteGoal(g: SavingsGoal) {
  if (await confirm({ title: 'Borrar hucha', message: `Se borra la hucha "${g.name}" con todos sus movimientos.` })) run(() => data.deleteGoal(g.id))
}
function toggleGoalPublic(g: SavingsGoal) {
  run(() => data.updateGoal(g.id, { is_public: !g.is_public }))
}
function moveGoal(g: SavingsGoal, amount: number, date: string, note: string | null, direction: 'in' | 'out') {
  run(() => data.addContribution(g.id, userId.value, amount, date, note, direction))
}
async function deleteContribution(c: Contribution) {
  if (!(await confirm({ title: 'Borrar movimiento', message: `¿Borrar el movimiento de ${formatEur(c.amount)}?` }))) return
  await run(() => data.deleteContribution(c.id))
  editor.toast('Movimiento borrado', { label: 'Deshacer', run: () => run(() => data.addContribution(c.goal_id, c.user_id, c.amount, c.contributed_on, c.note, c.direction)) })
}
function updateContribution(c: Contribution, amount: number, date: string, note: string | null, direction: 'in' | 'out') {
  run(() => data.updateContribution(c.id, { amount, contributed_on: date, note, direction }))
}
</script>

<template>
  <div class="space-yo stack">
    <div class="card accent">
      <div class="tiny" style="text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700">Mi mes</div>
      <div class="hero-number" style="margin: 0.2rem 0">{{ formatEur(totalMonth) }}</div>
      <div class="hero-split">
        <div><div class="label">Personal</div><div class="value">{{ formatEur(totalPersonal) }}</div></div>
        <div><div class="label">Repartido</div><div class="value">{{ formatEur(myShare) }}</div></div>
        <div><div class="label">Conjunta</div><div class="value">{{ formatEur(myPot) }}</div></div>
      </div>
    </div>

    <DetectedPayments
      :items="data.pendingPayments.value"
      :has-partner="!!partner"
      :category-by-id="data.categoryById.value"
      :kind-for="data.kindForPayment"
      :category-for="data.categoryForMerchant"
      :busy="paymentBusy"
      @pick="pickPayment"
      @dismiss="dismissPayment"
    />

    <PendingRecurring :items="myPending" :category-by-id="data.categoryById.value" :last-amount-of="data.lastAmountOf" @resolve="(id, a) => run(() => data.resolvePending(id, a))" @skip="(id) => run(() => data.skipPending(id))" />

    <div class="card">
      <template v-if="byCategory.length">
        <DonutChart :items="donutItems" :total="totalMonth" caption="este mes" :selected="selectedIdx" @select="selectSlice" />
        <CategoryBreakdown v-model:open="openCat" :rows="byCategory" :category-by-id="data.categoryById.value" />
      </template>
      <EmptyState v-else kind="gastos">Sin gastos este mes. Pulsa + para apuntar el primero.</EmptyState>
    </div>

    <BudgetCard :items="myItemsMonth" :month="month" :limit="myLimit" title="Mi límite del mes" @set-limit="setLimit" />

    <div class="card">
      <div class="row between" style="margin-bottom: 0.4rem">
        <h2>Últimos 6 meses</h2>
        <span class="tiny">personal + repartido + conjunta</span>
      </div>
      <MonthlyBars :labels="labels6" :datasets="bars6" average :highlight="5" />
      <router-link :to="{ name: 'year' }" class="year-link">Ver el resumen del año <UiIcon name="chevronRight" :size="16" /></router-link>
    </div>

    <p v-if="data.error.value || actionError" class="error">{{ actionError ?? data.error.value }}</p>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Mis gastos <span v-if="fixedCount" class="tag muted" style="margin-left: 0.3rem"><UiIcon name="repeat" :size="12" /> {{ fixedCount }} fijos</span></h2>
        <div class="row" style="gap: 0.1rem">
          <button type="button" class="icon" title="Buscar gastos" aria-label="Buscar gastos" @click="router.push({ name: 'search', query: { tipo: 'personal' } })"><UiIcon name="search" :size="20" /></button>
          <button type="button" class="small secondary" @click="editor.openNew('personal')">+ Añadir</button>
        </div>
      </div>
      <p class="tiny" style="margin-bottom: 0.5rem">Privados por defecto. Con los tres puntos de cada gasto puedes hacerlo visible para tu pareja, solo lectura.</p>
      <ExpenseList
        :expenses="myExpenses"
        :category-by-id="data.categoryById.value"
        :name-of="nameOf"
        editable
        privacy-toggle
        empty-text="Ningún gasto personal este mes."
        @edit="editor.openEdit"
        @delete="deleteExpense"
        @toggle-public="togglePublic"
      />
    </div>

    <div class="section-title">
      <h2>Mis huchas <span class="tag" style="margin-left: 0.3rem">{{ formatEur(totalSaved) }}</span></h2>
      <button type="button" class="small secondary" @click="editingGoal = undefined; showGoalForm = true">+ Hucha</button>
    </div>
    <EmptyState v-if="myGoals.length === 0" kind="huchas" class="card">Sin huchas todavía. Crea una para lo que quieras conseguir.</EmptyState>
    <GoalCard
      v-for="g in myGoals"
      :key="g.id"
      :goal="g"
      :contributions="contributionsOf(g.id)"
      :saved="data.savedByGoal.value[g.id] ?? 0"
      :name-of="nameOf"
      :current-user-id="userId"
      editable
      privacy-toggle
      @edit="editGoal"
      @delete="deleteGoal"
      @toggle-public="toggleGoalPublic"
      @move="moveGoal"
      @delete-contribution="deleteContribution"
      @update-contribution="updateContribution"
    />

    <GoalForm
      v-if="showGoalForm"
      :shared="false"
      :initial="editingGoal"
      @save="saveGoal"
      @close="showGoalForm = false; editingGoal = undefined"
    />
  </div>
</template>
