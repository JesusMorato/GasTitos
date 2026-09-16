// Carga y modifica gastos, categorías, liquidaciones, huchas y aportaciones.
// Supabase ya filtra por RLS: solo llegan las filas que el usuario puede ver.
import { computed, ref } from 'vue'
import { supabase } from '../supabase'
import type {
  Budget, BudgetScope, Category, Contribution, Expense, ExpenseShare, RecurringExpense, RecurringRun,
  SavingsGoal, Settlement, SplitMode, Funding,
} from '../types'
import { goalBalance, monthOf, todayIso, type Share } from '../lib/money'

const recurring = ref<RecurringExpense[]>([])
const runs = ref<RecurringRun[]>([])
let recurringRanFor = ''

const expenses = ref<Expense[]>([])
const shares = ref<ExpenseShare[]>([])
const categories = ref<Category[]>([])
const settlements = ref<Settlement[]>([])
const goals = ref<SavingsGoal[]>([])
const contributions = ref<Contribution[]>([])
const budgets = ref<Budget[]>([])
const loading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)

function fail(e: { message: string } | null) {
  if (e) {
    error.value = e.message
    throw new Error(e.message)
  }
}

// numeric(12,2) llega como string desde PostgREST; lo pasamos a número.
function num<T extends Record<string, unknown>>(row: T, keys: string[]): T {
  const out: Record<string, unknown> = { ...row }
  for (const k of keys) if (k in out) out[k] = Number(out[k])
  return out as T
}

async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const [e, s, c, st, g, gc, b, rc, rr] = await Promise.all([
      supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expense_shares').select('*'),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('settlements').select('*').order('settled_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: true }),
      supabase.from('goal_contributions').select('*').order('contributed_on', { ascending: false }),
      supabase.from('budgets').select('*'),
      supabase.from('recurring_expenses').select('*').order('created_at', { ascending: true }),
      supabase.from('recurring_runs').select('*'),
    ])
    fail(e.error); fail(s.error); fail(c.error); fail(st.error); fail(g.error); fail(gc.error); fail(b.error); fail(rc.error); fail(rr.error)
    budgets.value = (b.data ?? []).map((r) => num(r, ['monthly_limit'])) as Budget[]
    recurring.value = ((rc.data ?? []) as Record<string, unknown>[]).map((r) => ({
      ...r,
      amount: r.amount == null ? null : Number(r.amount),
      custom_pct: r.custom_pct == null ? null : Number(r.custom_pct),
    })) as unknown as RecurringExpense[]
    runs.value = (rr.data ?? []) as RecurringRun[]
    expenses.value = (e.data ?? []).map((r) => num(r, ['amount'])) as Expense[]
    shares.value = (s.data ?? []).map((r) => num(r, ['amount'])) as ExpenseShare[]
    categories.value = (c.data ?? []) as Category[]
    settlements.value = (st.data ?? []).map((r) => num(r, ['amount'])) as Settlement[]
    goals.value = ((g.data ?? []) as Record<string, unknown>[]).map((r) => ({ ...r, target_amount: r.target_amount == null ? null : Number(r.target_amount) })) as unknown as SavingsGoal[]
    contributions.value = (gc.data ?? []).map((r) => num(r, ['amount'])) as Contribution[]
    loaded.value = true
  } finally {
    loading.value = false
  }
}

export interface ExpenseInput {
  id?: string
  amount: number
  spent_on: string
  category_id: string
  description: string | null
  is_shared: boolean
  is_public?: boolean
  funding: Funding
  split_mode: SplitMode
  paid_by?: string
  shares?: Share[]
}

export type GoalInput = Pick<SavingsGoal, 'name' | 'emoji' | 'color' | 'target_amount' | 'deadline' | 'is_shared'> & {
  is_public?: boolean
}

export type RecurringInput = Pick<
  RecurringExpense,
  'name' | 'category_id' | 'amount' | 'kind' | 'split_mode' | 'custom_pct' | 'every_n_months' | 'start_month' | 'user_id'
>

export function useData() {
  /** Saldo de cada hucha: entradas − salidas. */
  const savedByGoal = computed<Record<string, number>>(() => {
    const byGoal: Record<string, Contribution[]> = {}
    for (const c of contributions.value) (byGoal[c.goal_id] ??= []).push(c)
    const map: Record<string, number> = {}
    for (const [id, list] of Object.entries(byGoal)) map[id] = goalBalance(list)
    return map
  })

  /**
   * Procesa los gastos fijos hasta el mes actual (una vez por sesión y mes) y
   * luego carga todo. Los fijos de importe fijo quedan apuntados; los variables,
   * pendientes.
   */
  async function syncRecurring() {
    const m = monthOf(todayIso())
    if (recurringRanFor === m) return
    recurringRanFor = m
    const { error: e } = await supabase.rpc('run_recurring', { p_month: m })
    if (e) {
      // No bloquea la app: se reintenta en la próxima carga.
      recurringRanFor = ''
      console.warn('run_recurring', e.message)
    }
  }

  const sharesByExpense = computed<Record<string, Share[]>>(() => {
    const map: Record<string, Share[]> = {}
    for (const s of shares.value) (map[s.expense_id] ??= []).push({ user_id: s.user_id, amount: s.amount })
    return map
  })

  const categoryById = computed<Record<string, Category>>(() => {
    const map: Record<string, Category> = {}
    for (const c of categories.value) map[c.id] = c
    return map
  })

  /** Gastos con sus partes ya incluidas (para balance y listados). */
  const expensesWithShares = computed(() =>
    expenses.value.map((e) => ({ ...e, shares: sharesByExpense.value[e.id] ?? [] })),
  )

  function ensureLoaded() {
    if (!loaded.value && !loading.value) return syncRecurring().then(loadAll).catch(() => {})
    return Promise.resolve()
  }

  // ---- gastos fijos ------------------------------------------
  const pendingRuns = computed(() =>
    runs.value
      .filter((r) => r.status === 'pending')
      .map((r) => ({ run: r, recurring: recurring.value.find((x) => x.id === r.recurring_id) }))
      .filter((x): x is { run: RecurringRun; recurring: RecurringExpense } => !!x.recurring),
  )

  /** Último importe apuntado para un gasto fijo (sugerencia para los variables). */
  function lastAmountOf(recurringId: string): number | null {
    const created = runs.value
      .filter((r) => r.recurring_id === recurringId && r.status === 'created' && r.expense_id)
      .sort((a, b) => (a.month < b.month ? 1 : -1))
    for (const r of created) {
      const x = expenses.value.find((e) => e.id === r.expense_id)
      if (x) return x.amount
    }
    return null
  }

  async function addRecurring(householdId: string, input: RecurringInput) {
    const { error: e } = await supabase.from('recurring_expenses').insert({ ...input, household_id: householdId })
    fail(e)
    recurringRanFor = ''
    await syncRecurring()
    await loadAll()
  }

  async function updateRecurring(id: string, patch: Partial<RecurringInput> & { active?: boolean }) {
    const { error: e } = await supabase.from('recurring_expenses').update(patch).eq('id', id)
    fail(e)
    recurringRanFor = ''
    await syncRecurring()
    await loadAll()
  }

  async function deleteRecurring(id: string) {
    const { error: e } = await supabase.from('recurring_expenses').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

  async function resolvePending(runId: string, amount: number) {
    const { error: e } = await supabase.rpc('resolve_pending', { p_run: runId, p_amount: amount })
    fail(e)
    await loadAll()
  }

  async function skipPending(runId: string) {
    const { error: e } = await supabase.rpc('skip_pending', { p_run: runId })
    fail(e)
    await loadAll()
  }

  // ---- gastos ------------------------------------------------
  async function saveExpense(input: ExpenseInput) {
    const { error: e } = await supabase.rpc('save_expense', { p: input })
    fail(e)
    await loadAll()
  }

  async function setExpensePublic(id: string, is_public: boolean) {
    const { error: e } = await supabase.from('expenses').update({ is_public }).eq('id', id)
    fail(e)
    await loadAll()
  }

  async function deleteExpense(id: string) {
    const { error: e } = await supabase.from('expenses').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

  // ---- categorías --------------------------------------------
  async function addCategory(householdId: string, input: Pick<Category, 'name' | 'emoji' | 'color' | 'icon'>) {
    const sort = (categories.value.at(-1)?.sort_order ?? 0) + 10
    const { error: e } = await supabase
      .from('categories')
      .insert({ ...input, name: input.name.trim(), household_id: householdId, sort_order: sort })
    fail(e)
    await loadAll()
  }

  async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'color' | 'icon' | 'sort_order'>>) {
    const { error: e } = await supabase.from('categories').update(patch).eq('id', id)
    fail(e)
    await loadAll()
  }

  async function deleteCategory(id: string) {
    const { error: e } = await supabase.from('categories').delete().eq('id', id)
    if (e && /foreign key|violates/i.test(e.message)) {
      throw new Error('Esta categoría tiene gastos. Muévelos a otra categoría antes de borrarla.')
    }
    fail(e)
    await loadAll()
  }

  // ---- liquidaciones -----------------------------------------
  async function addSettlement(householdId: string, input: Pick<Settlement, 'from_user' | 'to_user' | 'amount' | 'settled_on' | 'note'>) {
    const { error: e } = await supabase.from('settlements').insert({ ...input, household_id: householdId })
    fail(e)
    await loadAll()
  }

  async function deleteSettlement(id: string) {
    const { error: e } = await supabase.from('settlements').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

  // ---- huchas ------------------------------------------------
  async function addGoal(householdId: string, userId: string, input: GoalInput) {
    const { error: e } = await supabase
      .from('savings_goals')
      .insert({ ...input, household_id: householdId, user_id: userId })
    fail(e)
    await loadAll()
  }

  async function updateGoal(id: string, patch: Partial<GoalInput>) {
    const { error: e } = await supabase.from('savings_goals').update(patch).eq('id', id)
    fail(e)
    await loadAll()
  }

  async function deleteGoal(id: string) {
    const { error: e } = await supabase.from('savings_goals').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

  async function addContribution(
    goalId: string, userId: string, amount: number, contributed_on: string, note: string | null, direction: 'in' | 'out' = 'in',
  ) {
    const { error: e } = await supabase
      .from('goal_contributions')
      .insert({ goal_id: goalId, user_id: userId, amount, contributed_on, note, direction })
    fail(e)
    await loadAll()
  }

  async function deleteContribution(id: string) {
    const { error: e } = await supabase.from('goal_contributions').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

  // ---- límites mensuales -------------------------------------
  const potBudget = computed<Budget | null>(() => budgets.value.find((b) => b.scope === 'pot') ?? null)

  function myBudget(userId: string): Budget | null {
    return budgets.value.find((b) => b.scope === 'personal' && b.user_id === userId) ?? null
  }

  /** Crea, cambia o quita (null) el límite mensual de un ámbito. */
  async function setBudget(scope: BudgetScope, limit: number | null) {
    const { error: e } = await supabase.rpc('set_budget', { p_scope: scope, p_limit: limit })
    fail(e)
    await loadAll()
  }

  return {
    expenses, shares, categories, settlements, goals, contributions, budgets, recurring, runs, loading, loaded, error,
    savedByGoal, sharesByExpense, categoryById, expensesWithShares, potBudget, myBudget, setBudget,
    pendingRuns, lastAmountOf, addRecurring, updateRecurring, deleteRecurring, resolvePending, skipPending,
    loadAll, ensureLoaded,
    saveExpense, setExpensePublic, deleteExpense,
    addCategory, updateCategory, deleteCategory,
    addSettlement, deleteSettlement,
    addGoal, updateGoal, deleteGoal,
    addContribution, deleteContribution,
  }
}
