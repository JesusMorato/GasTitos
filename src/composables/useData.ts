// Carga y modifica gastos, categorías, liquidaciones, huchas y aportaciones.
// Supabase ya filtra por RLS: solo llegan las filas que el usuario puede ver.
import { computed, ref } from 'vue'
import { supabase } from '../supabase'
import type { Category, Contribution, Expense, ExpenseShare, SavingsGoal, Settlement, SplitMode, Funding } from '../types'
import { round2, type Share } from '../lib/money'

const expenses = ref<Expense[]>([])
const shares = ref<ExpenseShare[]>([])
const categories = ref<Category[]>([])
const settlements = ref<Settlement[]>([])
const goals = ref<SavingsGoal[]>([])
const contributions = ref<Contribution[]>([])
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
    const [e, s, c, st, g, gc] = await Promise.all([
      supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('expense_shares').select('*'),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true }),
      supabase.from('settlements').select('*').order('settled_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: true }),
      supabase.from('goal_contributions').select('*').order('contributed_on', { ascending: false }),
    ])
    fail(e.error); fail(s.error); fail(c.error); fail(st.error); fail(g.error); fail(gc.error)
    expenses.value = (e.data ?? []).map((r) => num(r, ['amount'])) as Expense[]
    shares.value = (s.data ?? []).map((r) => num(r, ['amount'])) as ExpenseShare[]
    categories.value = (c.data ?? []) as Category[]
    settlements.value = (st.data ?? []).map((r) => num(r, ['amount'])) as Settlement[]
    goals.value = (g.data ?? []).map((r) => num(r, ['target_amount'])) as SavingsGoal[]
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

export function useData() {
  const savedByGoal = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const c of contributions.value) map[c.goal_id] = round2((map[c.goal_id] ?? 0) + c.amount)
    return map
  })

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
    if (!loaded.value && !loading.value) return loadAll().catch(() => {})
    return Promise.resolve()
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
  async function addCategory(householdId: string, input: Pick<Category, 'name' | 'emoji' | 'color'>) {
    const sort = (categories.value.at(-1)?.sort_order ?? 0) + 10
    const { error: e } = await supabase
      .from('categories')
      .insert({ ...input, name: input.name.trim(), household_id: householdId, sort_order: sort })
    fail(e)
    await loadAll()
  }

  async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'color' | 'sort_order'>>) {
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

  async function addContribution(goalId: string, userId: string, amount: number, contributed_on: string, note: string | null) {
    const { error: e } = await supabase
      .from('goal_contributions')
      .insert({ goal_id: goalId, user_id: userId, amount, contributed_on, note })
    fail(e)
    await loadAll()
  }

  async function deleteContribution(id: string) {
    const { error: e } = await supabase.from('goal_contributions').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

  return {
    expenses, shares, categories, settlements, goals, contributions, loading, loaded, error,
    savedByGoal, sharesByExpense, categoryById, expensesWithShares,
    loadAll, ensureLoaded,
    saveExpense, setExpensePublic, deleteExpense,
    addCategory, updateCategory, deleteCategory,
    addSettlement, deleteSettlement,
    addGoal, updateGoal, deleteGoal,
    addContribution, deleteContribution,
  }
}
