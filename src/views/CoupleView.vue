<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../composables/useSession'
import { useData, type GoalInput } from '../composables/useData'
import { useEditor, type ExpenseRow } from '../composables/useEditor'
import { useMonth } from '../composables/useMonth'
import { useConfirm } from '../composables/useConfirm'
import { computeBalance, formatDate, formatEur, lastMonths, monthOf, paidByMember, shortMonth, sum, totalsBy, totalsByMonth } from '../lib/money'
import { cssVar } from '../lib/charts'
import type { Contribution, SavingsGoal, Settlement } from '../types'
import SegmentedControl from '../components/SegmentedControl.vue'
import BalanceCard from '../components/BalanceCard.vue'
import ExpenseList from '../components/ExpenseList.vue'
import CategoryIcon from '../components/CategoryIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import SettleForm from '../components/SettleForm.vue'
import GoalForm from '../components/GoalForm.vue'
import GoalCard from '../components/GoalCard.vue'
import DonutChart from '../components/DonutChart.vue'
import MonthlyBars from '../components/MonthlyBars.vue'
import BudgetCard from '../components/BudgetCard.vue'
import PendingRecurring from '../components/PendingRecurring.vue'
import UiIcon from '../components/UiIcon.vue'

type Tab = 'split' | 'pot' | 'goals'

const { state, partner, memberIds, nameOf } = useSession()
const data = useData()
const editor = useEditor()
const { month } = useMonth()
const { confirm } = useConfirm()
const router = useRouter()

const tab = ref<Tab>('split')
const tabs: Array<{ value: Tab; label: string }> = [
  { value: 'split', label: 'Repartidos' },
  { value: 'pot', label: 'Conjunta' },
  { value: 'goals', label: 'Huchas' },
]
const showSettle = ref(false)
const showHistory = ref(false)
const showPartnerPublic = ref(false)
const showGoalForm = ref(false)
const editingGoal = ref<SavingsGoal | undefined>()
const actionError = ref<string | null>(null)

onMounted(() => data.ensureLoaded(state.user?.id))

const userId = computed(() => state.user!.id)
const rows = computed<ExpenseRow[]>(() => data.expensesWithShares.value)

// --- Repartidos ---
const splitAll = computed(() => rows.value.filter((e) => e.is_shared && e.funding === 'personal'))
const splitMonth = computed(() => splitAll.value.filter((e) => monthOf(e.spent_on) === month.value))
const balance = computed(() => computeBalance(splitAll.value, data.settlements.value, memberIds.value))
const paidMonth = computed(() => paidByMember(splitMonth.value, memberIds.value))
const splitMonthTotal = computed(() => sum(splitMonth.value.map((e) => e.amount)))
const sharedPending = computed(() => data.pendingRuns.value.filter((p) => p.recurring.kind === 'shared'))

const months6 = computed(() => lastMonths(month.value, 6))
const labels6 = computed(() => months6.value.map(shortMonth))
const memberVars = ['--pareja', '--yo']
const paidBars = computed(() =>
  state.members.map((m, i) => ({
    label: m.display_name,
    values: totalsByMonth(splitAll.value.filter((e) => e.user_id === m.user_id), months6.value),
    color: cssVar(document.documentElement, memberVars[i] ?? '--accent', '#5b4f8f'),
  })),
)

// --- Cuenta conjunta ---
const potAll = computed(() => rows.value.filter((e) => e.is_shared && e.funding === 'pot'))
const potMonth = computed(() => potAll.value.filter((e) => monthOf(e.spent_on) === month.value))
const potTotal = computed(() => sum(potMonth.value.map((e) => e.amount)))
const potByCategory = computed(() => totalsBy(potMonth.value, (e) => e.category_id, (e) => e.amount))
const potDonut = computed(() =>
  potByCategory.value.map((c) => ({
    label: data.categoryById.value[c.key]?.name ?? 'Otros',
    value: c.total,
    color: data.categoryById.value[c.key]?.color ?? '#7a857f',
  })),
)
const potBars = computed(() => [{ label: 'Conjunta', values: totalsByMonth(potAll.value, months6.value) }])
const potLimit = computed(() => data.potBudget.value?.monthly_limit ?? null)
const potPending = computed(() => data.pendingRuns.value.filter((p) => p.recurring.kind === 'pot'))
const potFixedCount = computed(() => potMonth.value.filter((e) => e.recurring_id).length)

// --- Huchas ---
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

function setPotLimit(v: number | null) {
  run(() => data.setBudget('pot', v))
}
async function deleteExpense(x: ExpenseRow) {
  if (await confirm({ title: 'Borrar gasto', message: `¿Borrar el gasto de ${formatEur(x.amount)}?` })) run(() => data.deleteExpense(x.id))
}
function saveSettlement(v: Pick<Settlement, 'from_user' | 'to_user' | 'amount' | 'settled_on' | 'note'>) {
  showSettle.value = false
  run(() => data.addSettlement(state.household!.id, v))
}
async function deleteSettlement(s: Settlement) {
  if (await confirm({ title: 'Borrar pago', message: 'El balance volverá a contar lo que este pago saldaba.' })) run(() => data.deleteSettlement(s.id))
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
function moveGoal(g: SavingsGoal, amount: number, date: string, note: string | null, direction: 'in' | 'out') {
  run(() => data.addContribution(g.id, userId.value, amount, date, note, direction))
}
async function deleteContribution(c: Contribution) {
  if (await confirm({ title: 'Borrar movimiento', message: `¿Borrar el movimiento de ${formatEur(c.amount)}?` })) run(() => data.deleteContribution(c.id))
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

      <PendingRecurring :items="sharedPending" :category-by-id="data.categoryById.value" :last-amount-of="data.lastAmountOf" @resolve="(id, a) => run(() => data.resolvePending(id, a))" @skip="(id) => run(() => data.skipPending(id))" />

      <div class="card">
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

      <div v-if="partner" class="card">
        <div class="row between" style="margin-bottom: 0.4rem">
          <h2>Quién ha pagado, últimos 6 meses</h2>
        </div>
        <MonthlyBars :labels="labels6" :datasets="paidBars" :highlight="5" />
        <div class="row tiny" style="gap: 1rem; margin-top: 0.4rem">
          <span v-for="(m, i) in state.members" :key="m.user_id"><span class="dot-legend" :style="{ background: `var(${memberVars[i] ?? '--accent'})` }" /> {{ m.display_name }}</span>
        </div>
        <router-link :to="{ name: 'year' }" class="year-link">Ver el resumen del año <UiIcon name="chevronRight" :size="16" /></router-link>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top: 0">
          <h2>Gastos repartidos</h2>
          <div class="row" style="gap: 0.1rem">
            <button type="button" class="icon" title="Buscar gastos" aria-label="Buscar gastos" @click="router.push({ name: 'search', query: { tipo: 'shared' } })"><UiIcon name="search" :size="20" /></button>
            <button type="button" class="small secondary" :disabled="!partner" @click="editor.openNew('shared')">+ Añadir</button>
          </div>
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
          <UiIcon :name="showHistory ? 'chevronUp' : 'chevronDown'" :size="16" />
          Pagos entre vosotros ({{ data.settlements.value.length }})
        </button>
        <ul v-if="showHistory" class="list">
          <li v-if="data.settlements.value.length === 0" class="muted">Todavía no habéis saldado cuentas.</li>
          <li v-for="s in data.settlements.value" :key="s.id">
            <span class="emoji-badge" :style="{ '--badge': 'var(--pareja)' }"><UiIcon name="transfer" /></span>
            <div class="grow">
              <div>{{ nameOf(s.from_user) }} → {{ nameOf(s.to_user) }}<span v-if="s.note" class="muted"> · {{ s.note }}</span></div>
              <div class="tiny">{{ formatDate(s.settled_on) }}</div>
            </div>
            <span class="amount">{{ formatEur(s.amount) }}</span>
            <button type="button" class="icon" title="Borrar" aria-label="Borrar pago" @click="deleteSettlement(s)"><UiIcon name="trash" :size="18" /></button>
          </li>
        </ul>
      </div>

      <div v-if="partner" class="card flat">
        <button type="button" class="ghost small" style="padding-left: 0" @click="showPartnerPublic = !showPartnerPublic">
          <UiIcon :name="showPartnerPublic ? 'chevronUp' : 'chevronDown'" :size="16" />
          Lo que {{ partner.display_name }} comparte contigo ({{ partnerPublicExpenses.length + partnerPublicGoals.length }})
        </button>
        <template v-if="showPartnerPublic">
          <p class="tiny" style="margin: 0.3rem 0 0.5rem">Gastos y huchas personales que ha hecho públicos. Solo lectura.</p>
          <ExpenseList
            :expenses="partnerPublicExpenses"
            :category-by-id="data.categoryById.value"
            :name-of="nameOf"
            :editable="false"
            empty-text="No ha hecho público ningún gasto este mes."
          />
          <div class="stack" style="margin-top: 0.6rem">
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
          </div>
        </template>
      </div>
    </template>

    <!-- ===== Cuenta conjunta ===== -->
    <template v-else-if="tab === 'pot'">
      <div class="card accent">
        <div class="tiny" style="text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700">Gastado de la cuenta conjunta</div>
        <div class="hero-number" style="margin: 0.2rem 0">{{ formatEur(potTotal) }}</div>
        <div class="muted">Pagado con la cuenta común. No entra en el balance.</div>
      </div>

      <PendingRecurring :items="potPending" :category-by-id="data.categoryById.value" :last-amount-of="data.lastAmountOf" @resolve="(id, a) => run(() => data.resolvePending(id, a))" @skip="(id) => run(() => data.skipPending(id))" />

      <div class="card">
        <template v-if="potByCategory.length">
          <DonutChart :items="potDonut" :total="potTotal" caption="conjunta" />
          <ul class="donut-legend" :class="{ scrolling: potByCategory.length > 5 }">
            <li v-for="c in potByCategory" :key="c.key" :style="{ '--dot': data.categoryById.value[c.key]?.color }">
              <span class="dot" />
              <span class="name"><CategoryIcon variant="inline" :icon="data.categoryById.value[c.key]?.icon" :emoji="data.categoryById.value[c.key]?.emoji" :color="data.categoryById.value[c.key]?.color" />{{ data.categoryById.value[c.key]?.name }}</span>
              <span class="val">{{ formatEur(c.total) }}</span>
            </li>
          </ul>
        </template>
        <div v-else class="empty">Nada pagado con la cuenta conjunta este mes.</div>
      </div>

      <BudgetCard :items="potMonth" :month="month" :limit="potLimit" title="Límite de la cuenta conjunta" empty-hint="Ponle un límite mensual a la cuenta conjunta y veréis cómo os acercáis a él." @set-limit="setPotLimit" />

      <div class="card">
        <div class="row between" style="margin-bottom: 0.4rem">
          <h2>Cuenta conjunta, últimos 6 meses</h2>
        </div>
        <MonthlyBars :labels="labels6" :datasets="potBars" average :highlight="5" />
        <router-link :to="{ name: 'year' }" class="year-link">Ver el resumen del año <UiIcon name="chevronRight" :size="16" /></router-link>
      </div>

      <div class="card">
        <div class="section-title" style="margin-top: 0">
          <h2>Gastos de la cuenta conjunta <span v-if="potFixedCount" class="tag muted" style="margin-left: 0.3rem"><UiIcon name="repeat" :size="12" /> {{ potFixedCount }} fijos</span></h2>
          <div class="row" style="gap: 0.1rem">
            <button type="button" class="icon" title="Buscar gastos" aria-label="Buscar gastos" @click="router.push({ name: 'search', query: { tipo: 'pot' } })"><UiIcon name="search" :size="20" /></button>
            <button type="button" class="small secondary" @click="editor.openNew('pot')">+ Añadir</button>
          </div>
        </div>
        <ExpenseList
          :expenses="potMonth"
          :category-by-id="data.categoryById.value"
          :name-of="nameOf"
          editable
          empty-text="Ningún gasto de la cuenta conjunta este mes."
          @edit="editor.openEdit"
          @delete="deleteExpense"
        />
      </div>
    </template>

    <!-- ===== Huchas ===== -->
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
        :members="state.members"
        editable
        @edit="editGoal"
        @delete="deleteGoal"
        @move="moveGoal"
        @delete-contribution="deleteContribution"
      />
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
