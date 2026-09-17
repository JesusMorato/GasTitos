<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData, type GoalInput, type RecurringInput } from '../composables/useData'
import { useEditor, type ExpenseRow } from '../composables/useEditor'
import { useMonth } from '../composables/useMonth'
import { useConfirm } from '../composables/useConfirm'
import { formatEur, lastMonths, monthOf, myShareTotal, round2, shortMonth, sum, totalsBy, totalsByMonth } from '../lib/money'
import { myItems } from '../lib/insights'
import type { Contribution, RecurringExpense, SavingsGoal } from '../types'
import ExpenseList from '../components/ExpenseList.vue'
import CategoryIcon from '../components/CategoryIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'
import DonutChart from '../components/DonutChart.vue'
import MonthlyBars from '../components/MonthlyBars.vue'
import BudgetCard from '../components/BudgetCard.vue'
import PendingRecurring from '../components/PendingRecurring.vue'
import RecurringForm from '../components/RecurringForm.vue'
import RecurringList from '../components/RecurringList.vue'
import UiIcon from '../components/UiIcon.vue'

const { state, me, nameOf } = useSession()
const data = useData()
const editor = useEditor()
const { month } = useMonth()
const { confirm } = useConfirm()

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

const byCategory = computed(() => totalsBy(myItemsMonth.value, (x) => x.category_id, (x) => x.amount))
const donutItems = computed(() =>
  byCategory.value.map((c) => ({
    label: data.categoryById.value[c.key]?.name ?? 'Otros',
    value: c.total,
    color: data.categoryById.value[c.key]?.color ?? '#7a857f',
  })),
)

const months6 = computed(() => lastMonths(month.value, 6))
const bars6 = computed(() => [{ label: 'Gastado', values: totalsByMonth(myItemsAll.value, months6.value) }])
const labels6 = computed(() => months6.value.map(shortMonth))

const myLimit = computed(() => data.myBudget(userId.value)?.monthly_limit ?? null)
const myPending = computed(() => data.pendingRuns.value.filter((p) => p.recurring.kind === 'personal'))

// --- mis gastos fijos (solo los personales; los comunes se gestionan en Ajustes) ---
const myRecurring = computed(() => data.recurring.value.filter((r) => r.kind === 'personal' && r.user_id === userId.value))
const recOpen = ref(false)
const recEditing = ref<RecurringExpense | undefined>()
function openRec(r?: RecurringExpense) {
  recEditing.value = r
  recOpen.value = true
}
function saveRec(input: RecurringInput) {
  const editing = recEditing.value
  recOpen.value = false
  run(() => (editing ? data.updateRecurring(editing.id, input) : data.addRecurring(state.household!.id, input)))
}
function toggleRec(r: RecurringExpense) {
  run(() => data.updateRecurring(r.id, { active: !r.active }))
}
async function deleteRec(r: RecurringExpense) {
  if (await confirm({ title: 'Borrar gasto fijo', message: `Se borra "${r.name}". Los gastos que ya se apuntaron se quedan.` })) run(() => data.deleteRecurring(r.id))
}

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

function setLimit(v: number | null) {
  run(() => data.setBudget('personal', v))
}
async function deleteExpense(x: ExpenseRow) {
  if (await confirm({ title: 'Borrar gasto', message: `¿Borrar el gasto de ${formatEur(x.amount)}?` })) run(() => data.deleteExpense(x.id))
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
  if (await confirm({ title: 'Borrar movimiento', message: `¿Borrar el movimiento de ${formatEur(c.amount)}?` })) run(() => data.deleteContribution(c.id))
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

    <PendingRecurring :items="myPending" :category-by-id="data.categoryById.value" :last-amount-of="data.lastAmountOf" @resolve="(id, a) => run(() => data.resolvePending(id, a))" @skip="(id) => run(() => data.skipPending(id))" />

    <div class="card">
      <template v-if="byCategory.length">
        <DonutChart :items="donutItems" :total="totalMonth" caption="este mes" />
        <ul class="donut-legend" :class="{ scrolling: byCategory.length > 5 }">
          <li v-for="c in byCategory" :key="c.key" :style="{ '--dot': data.categoryById.value[c.key]?.color }">
            <span class="dot" />
            <span class="name"><CategoryIcon variant="inline" :icon="data.categoryById.value[c.key]?.icon" :emoji="data.categoryById.value[c.key]?.emoji" :color="data.categoryById.value[c.key]?.color" />{{ data.categoryById.value[c.key]?.name }}</span>
            <span class="val">{{ formatEur(c.total) }}</span>
          </li>
        </ul>
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
    </div>

    <p v-if="data.error.value || actionError" class="error">{{ actionError ?? data.error.value }}</p>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Mis gastos <span v-if="fixedCount" class="tag muted" style="margin-left: 0.3rem"><UiIcon name="repeat" :size="12" /> {{ fixedCount }} fijos</span></h2>
        <button type="button" class="small secondary" @click="editor.openNew('personal')">+ Añadir</button>
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

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Mis gastos fijos</h2>
        <button type="button" class="small secondary" @click="openRec()">+ Fijo</button>
      </div>
      <p class="tiny" style="margin-bottom: 0.4rem">Gimnasio, móvil, suscripciones… Se apuntan solos cada mes en tus gastos (día 1). Solo los ves tú.</p>
      <RecurringList
        :items="myRecurring"
        :category-by-id="data.categoryById.value"
        :name-of="nameOf"
        empty-text="Sin gastos fijos personales. Añade lo que pagas todos los meses."
        @toggle="toggleRec"
        @edit="openRec"
        @delete="deleteRec"
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
    />

    <RecurringForm
      v-if="recOpen && state.user"
      :members="state.members"
      :categories="data.categories.value"
      :current-user-id="state.user.id"
      :initial="recEditing"
      fixed-kind="personal"
      @save="saveRec"
      @close="recOpen = false"
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
