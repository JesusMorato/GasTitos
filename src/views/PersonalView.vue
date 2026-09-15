<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData, type GoalInput } from '../composables/useData'
import { useEditor, type ExpenseRow } from '../composables/useEditor'
import { formatEur, monthOf, myShareTotal, round2, sum, todayIso, totalsBy } from '../lib/money'
import type { Contribution, SavingsGoal } from '../types'
import MonthPicker from '../components/MonthPicker.vue'
import ExpenseList from '../components/ExpenseList.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'

const { state, nameOf } = useSession()
const data = useData()
const editor = useEditor()

const month = ref(monthOf(todayIso()))
const showGoalForm = ref(false)
const editingGoal = ref<SavingsGoal | undefined>()
const actionError = ref<string | null>(null)

onMounted(() => data.ensureLoaded())

const userId = computed(() => state.user!.id)
const rows = computed<ExpenseRow[]>(() => data.expensesWithShares.value)
const monthRows = computed(() => rows.value.filter((e) => monthOf(e.spent_on) === month.value))

const myExpenses = computed(() => monthRows.value.filter((e) => !e.is_shared && e.user_id === userId.value))
const totalPersonal = computed(() => sum(myExpenses.value.map((e) => e.amount)))
const myShare = computed(() => myShareTotal(monthRows.value, userId.value))
const totalMonth = computed(() => round2(totalPersonal.value + myShare.value))

/** Por categoría: mis gastos personales + mi parte de cada repartido. */
const byCategory = computed(() => {
  const items: Array<{ category_id: string; amount: number }> = []
  for (const e of monthRows.value) {
    if (!e.is_shared && e.user_id === userId.value) items.push({ category_id: e.category_id, amount: e.amount })
    else if (e.is_shared && e.funding === 'personal') {
      const mine = e.shares.find((s) => s.user_id === userId.value)?.amount ?? 0
      if (mine > 0) items.push({ category_id: e.category_id, amount: mine })
    }
  }
  return totalsBy(items, (x) => x.category_id, (x) => x.amount).slice(0, 6)
})

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

function deleteExpense(x: ExpenseRow) {
  if (confirm(`¿Borrar el gasto de ${formatEur(x.amount)}?`)) run(() => data.deleteExpense(x.id))
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
function deleteGoal(g: SavingsGoal) {
  if (confirm(`¿Borrar la hucha "${g.name}" y todas sus aportaciones?`)) run(() => data.deleteGoal(g.id))
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
  <div class="space-yo stack">
    <div class="card accent">
      <div class="tiny" style="text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700">Mi mes</div>
      <div class="hero-number" style="margin: 0.2rem 0">{{ formatEur(totalMonth) }}</div>
      <div class="muted tnum">Personal {{ formatEur(totalPersonal) }} · Mi parte en pareja {{ formatEur(myShare) }}</div>
    </div>

    <div class="card">
      <MonthPicker v-model="month" />
      <div v-if="byCategory.length" class="bars">
        <div v-for="c in byCategory" :key="c.key" class="bar-row" :style="{ '--bar': data.categoryById.value[c.key]?.color }">
          <div>
            <span>{{ data.categoryById.value[c.key]?.emoji }} {{ data.categoryById.value[c.key]?.name }}</span>
            <div class="progress"><div :style="{ width: (totalMonth ? (c.total / totalMonth) * 100 : 0) + '%' }" /></div>
          </div>
          <span class="amount tnum" style="font-weight: 600">{{ formatEur(c.total) }}</span>
        </div>
      </div>
      <div v-else class="empty">
        <span class="big-emoji">🌱</span>
        Sin gastos este mes. Pulsa ➕ para apuntar el primero.
      </div>
    </div>

    <p v-if="data.error.value || actionError" class="error">{{ actionError ?? data.error.value }}</p>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Mis gastos</h2>
        <button type="button" class="small secondary" @click="editor.openNew('personal')">+ Añadir</button>
      </div>
      <p class="tiny" style="margin-bottom: 0.5rem">🔒 Privados por defecto. El candado los hace visibles para tu pareja, solo lectura.</p>
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
    <div v-if="myGoals.length === 0" class="card empty">
      <span class="big-emoji">🐷</span>
      Sin huchas todavía. Crea una para lo que quieras conseguir.
    </div>
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

    <GoalForm
      v-if="showGoalForm"
      :shared="false"
      :initial="editingGoal"
      @save="saveGoal"
      @close="showGoalForm = false; editingGoal = undefined"
    />
  </div>
</template>
