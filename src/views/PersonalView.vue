<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData, type ExpenseInput, type GoalInput } from '../composables/useData'
import { formatEur, monthOf, sum, todayIso, totalsByCategory } from '../lib/money'
import type { Expense, SavingsGoal, Contribution } from '../types'
import MonthPicker from '../components/MonthPicker.vue'
import ExpenseForm from '../components/ExpenseForm.vue'
import ExpenseList from '../components/ExpenseList.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'

const { state, nameOf } = useSession()
const data = useData()

const month = ref(monthOf(todayIso()))
const showExpenseForm = ref(false)
const editingExpense = ref<Expense | undefined>()
const showGoalForm = ref(false)
const editingGoal = ref<SavingsGoal | undefined>()
const actionError = ref<string | null>(null)

onMounted(() => data.loadAll().catch(() => {}))

const userId = computed(() => state.user!.id)

const myExpenses = computed(() =>
  data.expenses.value.filter((e) => !e.is_shared && e.user_id === userId.value && monthOf(e.spent_on) === month.value),
)
const mySharedPaid = computed(() =>
  data.expenses.value.filter((e) => e.is_shared && e.user_id === userId.value && monthOf(e.spent_on) === month.value),
)
const totalPersonal = computed(() => sum(myExpenses.value.map((e) => e.amount)))
const totalSharedPaid = computed(() => sum(mySharedPaid.value.map((e) => e.amount)))
const byCategory = computed(() => totalsByCategory(myExpenses.value).slice(0, 5))
const myGoals = computed(() => data.goals.value.filter((g) => !g.is_shared && g.user_id === userId.value))

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

function saveExpense(input: ExpenseInput) {
  const editing = editingExpense.value
  showExpenseForm.value = false
  editingExpense.value = undefined
  run(() => (editing ? data.updateExpense(editing.id, input) : data.addExpense(state.household!.id, input)))
}
function editExpense(x: Expense) {
  editingExpense.value = x
  showExpenseForm.value = true
}
function deleteExpense(x: Expense) {
  if (confirm(`¿Borrar el gasto de ${formatEur(x.amount)} en ${x.category}?`)) run(() => data.deleteExpense(x.id))
}
function toggleExpensePublic(x: Expense) {
  run(() => data.updateExpense(x.id, { is_public: !x.is_public }))
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
function deleteGoal(g: SavingsGoal) {
  if (confirm(`¿Borrar el objetivo "${g.name}" y todas sus aportaciones?`)) run(() => data.deleteGoal(g.id))
}
function toggleGoalPublic(g: SavingsGoal) {
  run(() => data.updateGoal(g.id, { is_public: !g.is_public }))
}
function contribute(g: SavingsGoal, amount: number, date: string, note: string | null) {
  run(() => data.addContribution(g.id, userId.value, amount, date, note))
}
function deleteContribution(c: Contribution) {
  if (confirm('¿Borrar esta aportación?')) run(() => data.deleteContribution(c.id))
}
</script>

<template>
  <div class="card">
    <MonthPicker v-model="month" />
    <div class="grid2" style="margin-top: .8rem">
      <div>
        <div class="muted">Mis gastos personales</div>
        <div class="big">{{ formatEur(totalPersonal) }}</div>
      </div>
      <div>
        <div class="muted">Pagado por mí en pareja</div>
        <div class="big">{{ formatEur(totalSharedPaid) }}</div>
      </div>
    </div>
    <div v-if="byCategory.length" style="margin-top: .8rem">
      <div class="muted">Por categoría</div>
      <ul class="list">
        <li v-for="c in byCategory" :key="c.category">
          <span class="grow">{{ c.category }}</span>
          <span class="amount">{{ formatEur(c.total) }}</span>
        </li>
      </ul>
    </div>
  </div>

  <p class="muted">
    🔒 Lo personal es privado: tu pareja no lo ve. Pulsa el candado en cualquier gasto u objetivo para hacerlo público
    (solo podrá verlo, no tocarlo).
  </p>

  <p v-if="data.error.value || actionError" class="error">{{ actionError ?? data.error.value }}</p>

  <div class="card">
    <div class="row between">
      <h2>Mis gastos</h2>
      <button class="small" @click="editingExpense = undefined; showExpenseForm = true">+ Gasto</button>
    </div>
    <ExpenseList
      :expenses="myExpenses"
      :name-of="nameOf"
      editable
      privacy-toggle
      @edit="editExpense"
      @delete="deleteExpense"
      @toggle-public="toggleExpensePublic"
    />
  </div>

  <div class="row between" style="margin-bottom: .5rem">
    <h2>Mis objetivos</h2>
    <button class="small" @click="editingGoal = undefined; showGoalForm = true">+ Objetivo</button>
  </div>
  <p v-if="myGoals.length === 0" class="muted card">Sin objetivos personales todavía.</p>
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
    @contribute="contribute"
    @delete-contribution="deleteContribution"
  />

  <ExpenseForm
    v-if="showExpenseForm"
    :shared="false"
    :members="state.members"
    :current-user-id="userId"
    :initial="editingExpense"
    @save="saveExpense"
    @close="showExpenseForm = false; editingExpense = undefined"
  />
  <GoalForm
    v-if="showGoalForm"
    :shared="false"
    :initial="editingGoal"
    @save="saveGoal"
    @close="showGoalForm = false; editingGoal = undefined"
  />
</template>
