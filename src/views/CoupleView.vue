<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData, type GoalInput } from '../composables/useData'
import { useEditor, type ExpenseRow } from '../composables/useEditor'
import { computeBalance, formatEur, monthOf, paidByMember, sum, todayIso, totalsBy } from '../lib/money'
import type { Contribution, SavingsGoal, Settlement } from '../types'
import { formatDate } from '../lib/money'
import SegmentedControl from '../components/SegmentedControl.vue'
import MonthPicker from '../components/MonthPicker.vue'
import BalanceCard from '../components/BalanceCard.vue'
import ExpenseList from '../components/ExpenseList.vue'
import CategoryIcon from '../components/CategoryIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import SettleForm from '../components/SettleForm.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'

type Tab = 'split' | 'pot' | 'together'

const { state, partner, memberIds, nameOf } = useSession()
const data = useData()
const editor = useEditor()

const tab = ref<Tab>('split')
const tabs: Array<{ value: Tab; label: string }> = [
  { value: 'split', label: 'Repartidos' },
  { value: 'pot', label: 'Bote' },
  { value: 'together', label: 'Juntos' },
]
const month = ref(monthOf(todayIso()))
const showSettle = ref(false)
const showHistory = ref(false)
const showGoalForm = ref(false)
const editingGoal = ref<SavingsGoal | undefined>()
const actionError = ref<string | null>(null)

onMounted(() => data.ensureLoaded())

const userId = computed(() => state.user!.id)
const rows = computed<ExpenseRow[]>(() => data.expensesWithShares.value)

// --- Repartidos ---
const splitAll = computed(() => rows.value.filter((e) => e.is_shared && e.funding === 'personal'))
const splitMonth = computed(() => splitAll.value.filter((e) => monthOf(e.spent_on) === month.value))
const balance = computed(() => computeBalance(splitAll.value, data.settlements.value, memberIds.value))
const paidMonth = computed(() => paidByMember(splitMonth.value, memberIds.value))
const splitMonthTotal = computed(() => sum(splitMonth.value.map((e) => e.amount)))

// --- Bote ---
const potMonth = computed(() => rows.value.filter((e) => e.is_shared && e.funding === 'pot' && monthOf(e.spent_on) === month.value))
const potTotal = computed(() => sum(potMonth.value.map((e) => e.amount)))
const potByCategory = computed(() => totalsBy(potMonth.value, (e) => e.category_id, (e) => e.amount).slice(0, 6))

// --- Juntos ---
const sharedGoals = computed(() => data.goals.value.filter((g) => g.is_shared))
const partnerPublicExpenses = computed(() =>
  rows.value.filter((e) => !e.is_shared && e.is_public && e.user_id !== userId.value && monthOf(e.spent_on) === month.value),
)
const partnerPublicGoals = computed(() => data.goals.value.filter((g) => !g.is_shared && g.is_public && g.user_id !== userId.value))

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
function saveSettlement(v: Pick<Settlement, 'from_user' | 'to_user' | 'amount' | 'settled_on' | 'note'>) {
  showSettle.value = false
  run(() => data.addSettlement(state.household!.id, v))
}
function deleteSettlement(s: Settlement) {
  if (confirm('¿Borrar este pago? El balance volverá a incluirlo.')) run(() => data.deleteSettlement(s.id))
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
function contribute(g: SavingsGoal, amount: number, date: string, note: string | null) {
  run(() => data.addContribution(g.id, userId.value, amount, date, note))
}
function deleteContribution(c: Contribution) {
  if (confirm('¿Borrar esta aportación?')) run(() => data.deleteContribution(c.id))
}
</script>

<template>
  <div class="space-pareja stack">
    <div v-if="!partner" class="card">
      <EmptyState kind="pareja" />
      <h2>Invita a tu pareja</h2>
      <p class="muted">Todavía estás solo en <strong>{{ state.household?.name }}</strong>. Pásale este código para que se una:</p>
      <div class="code-invite">{{ state.household?.invite_code }}</div>
    </div>

    <SegmentedControl v-model="tab" :options="tabs" />

    <p v-if="data.error.value || actionError" class="error">{{ actionError ?? data.error.value }}</p>

    <!-- ===== Repartidos ===== -->
    <template v-if="tab === 'split'">
      <BalanceCard :balance="balance" :members="state.members" :current-user-id="userId" :name-of="nameOf" @settle="showSettle = true" />

      <div class="card">
        <MonthPicker v-model="month" />
        <div class="kpis">
          <div class="kpi">
            <div class="label">Repartido este mes</div>
            <div class="value">{{ formatEur(splitMonthTotal) }}</div>
          </div>
          <div v-for="m in state.members" :key="m.user_id" class="kpi">
            <div class="label">Pagó {{ m.display_name }}</div>
            <div class="value">{{ formatEur(paidMonth[m.user_id] ?? 0) }}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top: 0">
          <h2>Gastos repartidos</h2>
          <button type="button" class="small secondary" :disabled="!partner" @click="editor.openNew('shared')">+ Añadir</button>
        </div>
        <ExpenseList
          :expenses="splitMonth"
          :category-by-id="data.categoryById.value"
          :name-of="nameOf"
          editable
          show-payer
          show-split
          empty-text="Ningún gasto repartido este mes."
          @edit="editor.openEdit"
          @delete="deleteExpense"
        />
      </div>

      <div class="card flat">
        <button type="button" class="ghost small" style="padding-left: 0" @click="showHistory = !showHistory">
          {{ showHistory ? 'Ocultar pagos entre vosotros' : `Pagos entre vosotros (${data.settlements.value.length})` }}
        </button>
        <ul v-if="showHistory" class="list">
          <li v-if="data.settlements.value.length === 0" class="muted">Todavía no habéis saldado cuentas.</li>
          <li v-for="s in data.settlements.value" :key="s.id">
            <span class="emoji-badge" :style="{ '--badge': 'var(--pareja)' }">💸</span>
            <div class="grow">
              <div>{{ nameOf(s.from_user) }} → {{ nameOf(s.to_user) }}<span v-if="s.note" class="muted"> · {{ s.note }}</span></div>
              <div class="tiny">{{ formatDate(s.settled_on) }}</div>
            </div>
            <span class="amount">{{ formatEur(s.amount) }}</span>
            <button type="button" class="icon" title="Borrar" @click="deleteSettlement(s)">🗑️</button>
          </li>
        </ul>
      </div>
    </template>

    <!-- ===== Bote ===== -->
    <template v-else-if="tab === 'pot'">
      <div class="card accent">
        <div class="tiny" style="text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700">Gastado del bote</div>
        <div class="hero-number" style="margin: 0.2rem 0">{{ formatEur(potTotal) }}</div>
        <div class="muted">Pagado con la cuenta conjunta. No entra en el balance.</div>
      </div>

      <div class="card">
        <MonthPicker v-model="month" />
        <div v-if="potByCategory.length" class="bars">
          <div v-for="c in potByCategory" :key="c.key" class="bar-row" :style="{ '--bar': data.categoryById.value[c.key]?.color }">
            <div>
              <span><CategoryIcon variant="inline" :icon="data.categoryById.value[c.key]?.icon" :emoji="data.categoryById.value[c.key]?.emoji" :color="data.categoryById.value[c.key]?.color" />{{ data.categoryById.value[c.key]?.name }}</span>
              <div class="progress"><div :style="{ width: (potTotal ? (c.total / potTotal) * 100 : 0) + '%' }" /></div>
            </div>
            <span class="amount tnum" style="font-weight: 600">{{ formatEur(c.total) }}</span>
          </div>
        </div>
        <div v-else class="empty">Nada pagado con el bote este mes.</div>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top: 0">
          <h2>Gastos del bote</h2>
          <button type="button" class="small secondary" @click="editor.openNew('pot')">+ Añadir</button>
        </div>
        <ExpenseList
          :expenses="potMonth"
          :category-by-id="data.categoryById.value"
          :name-of="nameOf"
          editable
          empty-text="Ningún gasto del bote este mes."
          @edit="editor.openEdit"
          @delete="deleteExpense"
        />
      </div>
    </template>

    <!-- ===== Juntos ===== -->
    <template v-else>
      <div class="section-title" style="margin-top: 0.2rem">
        <h2>Huchas en pareja</h2>
        <button type="button" class="small secondary" @click="editingGoal = undefined; showGoalForm = true">+ Hucha</button>
      </div>
      <EmptyState v-if="sharedGoals.length === 0" kind="huchas" class="card">Aún no tenéis huchas comunes. ¿Un viaje? ¿Un colchón de emergencia?</EmptyState>
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
        <div class="section-title">
          <h2>Lo que {{ partner.display_name }} comparte contigo</h2>
        </div>
        <p class="muted">Gastos y huchas personales que ha hecho públicos. Solo lectura.</p>
        <div class="card">
          <MonthPicker v-model="month" />
          <div class="tiny" style="margin-bottom: 0.4rem">
            Gastos públicos: <strong class="tnum">{{ formatEur(sum(partnerPublicExpenses.map((e) => e.amount))) }}</strong>
          </div>
          <ExpenseList
            :expenses="partnerPublicExpenses"
            :category-by-id="data.categoryById.value"
            :name-of="nameOf"
            :editable="false"
            empty-text="No ha hecho público ningún gasto este mes."
          />
        </div>
        <div v-if="partnerPublicGoals.length === 0" class="card flat empty">No ha hecho pública ninguna hucha.</div>
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
    </template>

    <SettleForm
      v-if="showSettle"
      :members="state.members"
      :suggested="balance.settlement"
      :name-of="nameOf"
      @save="saveSettlement"
      @close="showSettle = false"
    />
    <GoalForm
      v-if="showGoalForm"
      shared
      :initial="editingGoal"
      @save="saveGoal"
      @close="showGoalForm = false; editingGoal = undefined"
    />
  </div>
</template>
