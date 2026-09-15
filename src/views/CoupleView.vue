<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData, type ExpenseInput, type GoalInput } from '../composables/useData'
import { computeBalance, formatEur, monthOf, sum, todayIso, totalsByCategory } from '../lib/money'
import type { Expense, SavingsGoal, Contribution } from '../types'
import MonthPicker from '../components/MonthPicker.vue'
import ExpenseForm from '../components/ExpenseForm.vue'
import ExpenseList from '../components/ExpenseList.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'

const { state, partner, nameOf } = useSession()
const data = useData()

const month = ref(monthOf(todayIso()))
const showExpenseForm = ref(false)
const editingExpense = ref<Expense | undefined>()
const showGoalForm = ref(false)
const editingGoal = ref<SavingsGoal | undefined>()
const actionError = ref<string | null>(null)

onMounted(() => data.loadAll().catch(() => {}))

const userId = computed(() => state.user!.id)
const memberIds = computed(() => state.members.map((m) => m.user_id))

const sharedThisMonth = computed(() =>
  data.expenses.value.filter((e) => e.is_shared && monthOf(e.spent_on) === month.value),
)
const balance = computed(() => computeBalance(sharedThisMonth.value, memberIds.value))
const byCategory = computed(() => totalsByCategory(sharedThisMonth.value).slice(0, 5))
const sharedGoals = computed(() => data.goals.value.filter((g) => g.is_shared))

// Lo que mi pareja ha decidido hacer público (solo lectura)
const partnerPublicExpenses = computed(() =>
  data.expenses.value.filter(
    (e) => !e.is_shared && e.is_public && e.user_id !== userId.value && monthOf(e.spent_on) === month.value,
  ),
)
const partnerPublicGoals = computed(() =>
  data.goals.value.filter((g) => !g.is_shared && g.is_public && g.user_id !== userId.value),
)

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
function contribute(g: SavingsGoal, amount: number, date: string, note: string | null) {
  run(() => data.addContribution(g.id, userId.value, amount, date, note))
}
function deleteContribution(c: Contribution) {
  if (confirm('¿Borrar esta aportación?')) run(() => data.deleteContribution(c.id))
}
</script>

<template>
  <div v-if="!partner" class="card">
    <h2>Invita a tu pareja</h2>
    <p>Todavía estás solo en el hogar <strong>{{ state.household?.name }}</strong>. Pásale este código para que se una:</p>
    <p class="big" style="letter-spacing: .15em">{{ state.household?.invite_code }}</p>
    <p class="muted">Mientras tanto ya puedes ir apuntando gastos.</p>
  </div>

  <div class="card">
    <MonthPicker v-model="month" />
    <div class="grid2" style="margin-top: .8rem">
      <div>
        <div class="muted">Gastado en pareja</div>
        <div class="big">{{ formatEur(balance.total) }}</div>
      </div>
      <div>
        <div class="muted">Balance</div>
        <div v-if="balance.settlement">
          <strong>{{ nameOf(balance.settlement.from) }}</strong> debe
          <strong>{{ formatEur(balance.settlement.amount) }}</strong> a
          <strong>{{ nameOf(balance.settlement.to) }}</strong>
        </div>
        <div v-else class="ok">Estáis en paz 🎉</div>
      </div>
    </div>
    <div v-if="state.members.length" class="muted" style="margin-top: .5rem">
      <span v-for="m in state.members" :key="m.user_id" style="margin-right: 1rem">
        {{ m.display_name }}: {{ formatEur(balance.paidBy[m.user_id] ?? 0) }}
      </span>
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

  <p v-if="data.error.value || actionError" class="error">{{ actionError ?? data.error.value }}</p>

  <div class="card">
    <div class="row between">
      <h2>Gastos compartidos</h2>
      <button class="small" @click="editingExpense = undefined; showExpenseForm = true">+ Gasto</button>
    </div>
    <ExpenseList
      :expenses="sharedThisMonth"
      :name-of="nameOf"
      editable
      show-payer
      @edit="editExpense"
      @delete="deleteExpense"
    />
  </div>

  <div class="row between" style="margin-bottom: .5rem">
    <h2>Objetivos en pareja</h2>
    <button class="small" @click="editingGoal = undefined; showGoalForm = true">+ Objetivo</button>
  </div>
  <p v-if="sharedGoals.length === 0" class="muted card">Aún no tenéis objetivos comunes. ¿Un viaje? ¿Un colchón de emergencia?</p>
  <GoalCard
    v-for="g in sharedGoals"
    :key="g.id"
    :goal="g"
    :contributions="contributionsOf(g.id)"
    :saved="data.savedByGoal.value[g.id] ?? 0"
    :name-of="nameOf"
    :current-user-id="userId"
    editable
    @edit="editGoal"
    @delete="deleteGoal"
    @contribute="contribute"
    @delete-contribution="deleteContribution"
  />

  <template v-if="partner">
    <h2 style="margin-top: 1.5rem">Lo que {{ partner.display_name }} comparte contigo</h2>
    <p class="muted">Gastos y objetivos personales que ha marcado como públicos. Solo lectura.</p>

    <div class="card">
      <h3>Gastos personales públicos · {{ formatEur(sum(partnerPublicExpenses.map((e) => e.amount))) }}</h3>
      <ExpenseList :expenses="partnerPublicExpenses" :name-of="nameOf" :editable="false" />
    </div>

    <p v-if="partnerPublicGoals.length === 0" class="muted card">No ha hecho público ningún objetivo.</p>
    <GoalCard
      v-for="g in partnerPublicGoals"
      :key="g.id"
      :goal="g"
      :contributions="contributionsOf(g.id)"
      :saved="data.savedByGoal.value[g.id] ?? 0"
      :name-of="nameOf"
      :current-user-id="userId"
      :editable="false"
    />
  </template>

  <ExpenseForm
    v-if="showExpenseForm"
    shared
    :members="state.members"
    :current-user-id="userId"
    :initial="editingExpense"
    @save="saveExpense"
    @close="showExpenseForm = false; editingExpense = undefined"
  />
  <GoalForm
    v-if="showGoalForm"
    shared
    :initial="editingGoal"
    @save="saveGoal"
    @close="showGoalForm = false; editingGoal = undefined"
  />

</template>
