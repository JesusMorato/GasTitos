// Carga y modifica gastos, objetivos y aportaciones del hogar.
// Supabase ya filtra por RLS: solo llegan las filas que el usuario puede ver.
import { computed, ref } from 'vue'
import { supabase } from '../supabase'
import type { Contribution, Expense, SavingsGoal } from '../types'
import { round2 } from '../lib/money'

const expenses = ref<Expense[]>([])
const goals = ref<SavingsGoal[]>([])
const contributions = ref<Contribution[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

function fail(e: { message: string } | null) {
  if (e) {
    error.value = e.message
    throw new Error(e.message)
  }
}

async function loadAll() {
  loading.value = true
  error.value = null
  try {
    const [e, g, c] = await Promise.all([
      supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('savings_goals').select('*').order('created_at', { ascending: true }),
      supabase.from('goal_contributions').select('*').order('contributed_on', { ascending: false }),
    ])
    fail(e.error); fail(g.error); fail(c.error)
    expenses.value = (e.data ?? []).map(numeric) as Expense[]
    goals.value = (g.data ?? []).map(numericGoal) as SavingsGoal[]
    contributions.value = (c.data ?? []).map(numeric) as Contribution[]
  } finally {
    loading.value = false
  }
}

// numeric(12,2) llega como string desde PostgREST; lo pasamos a número.
function numeric<T extends { amount: unknown }>(row: T): T {
  return { ...row, amount: Number(row.amount) }
}
function numericGoal<T extends { target_amount: unknown }>(row: T): T {
  return { ...row, target_amount: Number(row.target_amount) }
}

export type ExpenseInput = Pick<Expense, 'amount' | 'spent_on' | 'category' | 'description' | 'is_shared' | 'user_id'> & {
  is_public?: boolean
}
export type GoalInput = Pick<SavingsGoal, 'name' | 'target_amount' | 'deadline' | 'is_shared'> & { is_public?: boolean }

export function useData() {
  const savedByGoal = computed<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    for (const c of contributions.value) {
      map[c.goal_id] = round2((map[c.goal_id] ?? 0) + c.amount)
    }
    return map
  })

  async function addExpense(householdId: string, input: ExpenseInput) {
    const { error: e } = await supabase.from('expenses').insert({ ...input, household_id: householdId })
    fail(e)
    await loadAll()
  }

  async function updateExpense(id: string, patch: Partial<ExpenseInput>) {
    const { error: e } = await supabase.from('expenses').update(patch).eq('id', id)
    fail(e)
    await loadAll()
  }

  async function deleteExpense(id: string) {
    const { error: e } = await supabase.from('expenses').delete().eq('id', id)
    fail(e)
    await loadAll()
  }

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
    expenses, goals, contributions, loading, error, savedByGoal,
    loadAll,
    addExpense, updateExpense, deleteExpense,
    addGoal, updateGoal, deleteGoal,
    addContribution, deleteContribution,
  }
}
