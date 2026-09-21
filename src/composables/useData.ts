// Carga y modifica gastos, categorías, liquidaciones, huchas y aportaciones.
// Supabase ya filtra por RLS: solo llegan las filas que el usuario puede ver.
import { computed, ref } from 'vue'
import { supabase } from '../supabase'
import type {
  Budget, BudgetScope, Category, Contribution, DetectedPayment, Expense, ExpenseShare, PaymentKind, PaymentSettings,
  PushSubscriptionRow, RecurringExpense, RecurringRun, SavingsGoal, Settlement, SplitMode, Funding,
} from '../types'
import { goalBalance, monthOf, todayIso, type Share } from '../lib/money'
import { isNetworkError, loadSnapshot, online, saveSnapshot } from '../lib/offline'
import { cardsSeen, newToken, remembered, suggestKind, type Remembered } from '../lib/payments'

// Supabase devuelve como mucho 1000 filas por consulta. Con los años una pareja
// pasa de ahí (y el balance necesita TODOS los repartidos), así que se pide por
// páginas hasta que venga una incompleta.
const PAGE = 1000
type Row = Record<string, unknown>
interface PagedQuery { range: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }> }
async function fetchAll(build: () => PagedQuery): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error: e } = await build().range(from, from + PAGE - 1)
    fail(e)
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < PAGE) return out
  }
}

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
const detected = ref<DetectedPayment[]>([])
const paymentSettings = ref<PaymentSettings | null>(null)
/** Pagos detectados que tu pareja aún no ha apuntado (solo el número). */
const partnerPending = ref(0)
const loading = ref(false)
const loaded = ref(false)
const error = ref<string | null>(null)
let loadedAt = 0
let loadedFor = '' // usuario al que pertenecen los datos cargados
/** true cuando lo que se ve es la copia local porque no hay conexión. */
const offline = ref(false)
/** Fecha de la copia que se está enseñando (solo en modo sin conexión). */
const snapshotAt = ref<number | null>(null)

interface Snapshot {
  expenses: Expense[]; shares: ExpenseShare[]; categories: Category[]; settlements: Settlement[]
  goals: SavingsGoal[]; contributions: Contribution[]; budgets: Budget[]; recurring: RecurringExpense[]; runs: RecurringRun[]
  detected?: DetectedPayment[]; paymentSettings?: PaymentSettings | null
}
function snapshot(): Snapshot {
  return {
    expenses: expenses.value, shares: shares.value, categories: categories.value, settlements: settlements.value,
    goals: goals.value, contributions: contributions.value, budgets: budgets.value, recurring: recurring.value, runs: runs.value,
    detected: detected.value, paymentSettings: paymentSettings.value,
  }
}
function applySnapshot(s: Snapshot) {
  expenses.value = s.expenses; shares.value = s.shares; categories.value = s.categories; settlements.value = s.settlements
  goals.value = s.goals; contributions.value = s.contributions; budgets.value = s.budgets; recurring.value = s.recurring; runs.value = s.runs
  detected.value = s.detected ?? []; paymentSettings.value = s.paymentSettings ?? null
}

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
    const [e, s, c, st, g, gc, b, rc, rr, dp, ps] = await Promise.all([
      fetchAll(() => supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('created_at', { ascending: false })),
      fetchAll(() => supabase.from('expense_shares').select('*').order('expense_id').order('user_id')),
      fetchAll(() => supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name', { ascending: true })),
      fetchAll(() => supabase.from('settlements').select('*').order('settled_on', { ascending: false }).order('created_at', { ascending: false })),
      fetchAll(() => supabase.from('savings_goals').select('*').order('created_at', { ascending: true })),
      fetchAll(() => supabase.from('goal_contributions').select('*').order('contributed_on', { ascending: false }).order('created_at', { ascending: false })),
      fetchAll(() => supabase.from('budgets').select('*').order('id')),
      fetchAll(() => supabase.from('recurring_expenses').select('*').order('created_at', { ascending: true })),
      fetchAll(() => supabase.from('recurring_runs').select('*').order('id')),
      fetchAll(() => supabase.from('detected_payments').select('*').order('paid_at', { ascending: false })),
      fetchAll(() => supabase.from('payment_settings').select('*').order('user_id')),
    ])
    detected.value = dp.map((r) => num(r, ['amount'])) as unknown as DetectedPayment[]
    paymentSettings.value = (ps[0] as unknown as PaymentSettings | undefined) ?? null
    // Solo un número; si la función aún no existe (migración sin aplicar), 0 y sin ruido.
    const { data: pp } = await supabase.rpc('partner_pending_payments')
    partnerPending.value = Number(pp ?? 0)
    budgets.value = b.map((r) => num(r, ['monthly_limit'])) as unknown as Budget[]
    recurring.value = rc.map((r) => ({
      ...r,
      amount: r.amount == null ? null : Number(r.amount),
      custom_pct: r.custom_pct == null ? null : Number(r.custom_pct),
    })) as unknown as RecurringExpense[]
    runs.value = rr as unknown as RecurringRun[]
    expenses.value = e.map((r) => num(r, ['amount'])) as unknown as Expense[]
    shares.value = s.map((r) => num(r, ['amount'])) as unknown as ExpenseShare[]
    categories.value = c as unknown as Category[]
    settlements.value = st.map((r) => num(r, ['amount'])) as unknown as Settlement[]
    goals.value = g.map((r) => ({ ...r, target_amount: r.target_amount == null ? null : Number(r.target_amount) })) as unknown as SavingsGoal[]
    contributions.value = gc.map((r) => num(r, ['amount'])) as unknown as Contribution[]
    loaded.value = true
    loadedAt = Date.now()
    offline.value = false
    snapshotAt.value = null
    if (loadedFor) saveSnapshot(loadedFor, snapshot())
  } catch (e) {
    // Sin red: se enseña la última copia guardada de este usuario, si la hay.
    const copy = loadedFor ? loadSnapshot<Snapshot>(loadedFor) : null
    if (isNetworkError(e) && copy) {
      applySnapshot(copy.value)
      loaded.value = true
      offline.value = true
      snapshotAt.value = copy.at
      error.value = null
      return
    }
    throw e
  } finally {
    loading.value = false
  }
}

/** Vacía todo lo cargado (al cerrar sesión o cambiar de usuario). */
function reset() {
  expenses.value = []; shares.value = []; categories.value = []; settlements.value = []
  goals.value = []; contributions.value = []; budgets.value = []; recurring.value = []; runs.value = []
  detected.value = []; paymentSettings.value = null
  loaded.value = false
  error.value = null
  offline.value = false
  snapshotAt.value = null
  loadedAt = 0
  loadedFor = ''
  recurringRanFor = ''
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
    if (recurringRanFor === m || !online.value) return
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

  /**
   * Carga los datos si no están (o si son de otro usuario: p. ej. tras cerrar
   * sesión y entrar con la otra cuenta en el mismo móvil).
   */
  function ensureLoaded(userId?: string) {
    if (userId && loadedFor && loadedFor !== userId) reset()
    if (userId) loadedFor = userId
    if (!loaded.value && !loading.value) return syncRecurring().then(loadAll).catch(() => {})
    return Promise.resolve()
  }

  /**
   * Al volver a la app (cambio de pestaña, desbloquear el móvil) recarga si los
   * datos tienen más de un minuto: así se ven los gastos que apuntó la pareja y,
   * en un mes nuevo, se procesan los gastos fijos sin tener que recargar la página.
   */
  async function refreshIfStale(maxAgeMs = 60_000) {
    if (!loaded.value || loading.value || !online.value) return
    if (!offline.value && Date.now() - loadedAt < maxAgeMs) {
      // Datos recientes: solo se miran los pagos detectados, que pueden haber
      // llegado hace segundos (se acaba de pagar con el móvil).
      await refreshPayments()
      return
    }
    try {
      await syncRecurring()
      await loadAll()
    } catch {
      // Se reintentará en la próxima vuelta a la app.
    }
  }

  /** Consulta solo los pagos detectados (barata; se hace cada vez que se vuelve a la app). */
  async function refreshPayments() {
    if (!loaded.value || offline.value || !online.value) return
    try {
      const rows = await fetchAll(() => supabase.from('detected_payments').select('*').order('paid_at', { ascending: false }))
      detected.value = rows.map((r) => num(r, ['amount'])) as unknown as DetectedPayment[]
    } catch {
      // Sin red o error pasajero: se queda lo que había.
    }
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
  /**
   * Guarda el gasto y, si es nuevo y le toca a la pareja (repartido o de la cuenta
   * conjunta), le manda un aviso al móvil. El aviso va por detrás: si falla, el
   * gasto queda guardado igual.
   */
  async function guardarGasto(input: ExpenseInput): Promise<string> {
    const { data: id, error: e } = await supabase.rpc('save_expense', { p: input })
    fail(e)
    const nuevoId = String(id)
    if (!input.id && input.is_shared) void notifyPartner(nuevoId)
    return nuevoId
  }

  async function saveExpense(input: ExpenseInput): Promise<string> {
    const id = await guardarGasto(input)
    await loadAll()
    return id
  }

  /** Resultado de probar el envío de avisos a mis propios aparatos. */
  async function testPushDelivery(): Promise<{
    estado?: string
    claves?: boolean
    sujeto?: string
    aparatos?: number
    resultados?: Array<{ aparato: string; servicio: string; codigo: number; detalle: string }>
    error?: string
  }> {
    const { data: r, error: e } = await supabase.functions.invoke('notify-partner', { body: { prueba: true } })
    if (e) throw new Error(e.message)
    return (r ?? {}) as Record<string, never>
  }

  /** Avisa a la pareja de un gasto repartido o de la cuenta conjunta. */
  async function notifyPartner(expenseId: string) {
    try {
      await supabase.functions.invoke('notify-partner', { body: { expense_id: expenseId } })
    } catch {
      // Sin red o función sin publicar: no pasa nada, el gasto ya está guardado.
    }
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

  /** Vuelve a crear un gasto recién borrado (Deshacer). Sale con id nuevo. */
  async function reinsertExpense(x: Expense & { shares: Share[] }) {
    await saveExpense({
      amount: x.amount, spent_on: x.spent_on, category_id: x.category_id, description: x.description,
      is_shared: x.is_shared, is_public: x.is_public, funding: x.funding, split_mode: x.split_mode,
      paid_by: x.user_id, shares: x.shares,
    })
  }

  // ---- categorías --------------------------------------------
  function categoryError(e: { message: string } | null) {
    if (e && /duplicate key|unique/i.test(e.message)) throw new Error('Ya hay una categoría con ese nombre.')
    fail(e)
  }

  async function addCategory(householdId: string, input: Pick<Category, 'name' | 'emoji' | 'color' | 'icon'>) {
    const sort = (categories.value.at(-1)?.sort_order ?? 0) + 10
    const { error: e } = await supabase
      .from('categories')
      .insert({ ...input, name: input.name.trim(), household_id: householdId, sort_order: sort })
    categoryError(e)
    await loadAll()
  }

  async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'emoji' | 'color' | 'icon' | 'sort_order'>>) {
    const { error: e } = await supabase.from('categories').update(patch).eq('id', id)
    categoryError(e)
    await loadAll()
  }

  /** Guarda de golpe el nuevo orden de varias categorías (al arrastrar). */
  async function reorderCategories(updates: { id: string; sort_order: number }[]) {
    if (updates.length === 0) return
    const results = await Promise.all(updates.map((u) => supabase.from('categories').update({ sort_order: u.sort_order }).eq('id', u.id)))
    for (const r of results) fail(r.error)
    await loadAll()
  }

  /** Pasa todos los gastos (y fijos) de una categoría a otra; con `del`, borra la de origen. */
  async function moveCategory(from: string, to: string, del: boolean): Promise<number> {
    const { data: n, error: e } = await supabase.rpc('move_category', { p_from: from, p_to: to, p_delete: del })
    fail(e)
    await loadAll()
    return Number(n ?? 0)
  }

  async function deleteCategory(id: string) {
    const { error: e } = await supabase.from('categories').delete().eq('id', id)
    if (e && /foreign key|violates/i.test(e.message)) {
      throw new Error('Esta categoría tiene gastos o gastos fijos. Cámbialos a otra categoría antes de borrarla.')
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

  async function updateContribution(id: string, patch: Pick<Contribution, 'amount' | 'contributed_on' | 'note' | 'direction'>) {
    const { error: e } = await supabase.from('goal_contributions').update(patch).eq('id', id)
    fail(e)
    await loadAll()
  }

  // ---- pagos detectados (Apple Pay → atajo → aquí) -------------
  const pendingPayments = computed(() => detected.value.filter((d) => d.status === 'pending'))
  const expenseById = computed<Record<string, Expense>>(() => {
    const map: Record<string, Expense> = {}
    for (const e of expenses.value) map[e.id] = e
    return map
  })
  const paymentCards = computed(() => cardsSeen(detected.value))
  /** Lo recordado del comercio (última vez que se apuntó un pago suyo), o null. */
  function memoryFor(merchant: string): Remembered | null {
    return remembered(merchant, detected.value, expenseById.value)
  }
  /** Tipo propuesto para un pago: memoria del comercio, luego la tarjeta. */
  function kindForPayment(p: DetectedPayment): PaymentKind {
    return suggestKind(p.card, paymentSettings.value?.card_kinds ?? {}, memoryFor(p.merchant))
  }
  /** Tipo propuesto solo por la tarjeta (Ajustes). */
  function kindForCard(card: string): PaymentKind {
    return suggestKind(card, paymentSettings.value?.card_kinds ?? {})
  }
  function categoryForMerchant(merchant: string): string | null {
    return memoryFor(merchant)?.category_id ?? null
  }
  /** Apunta el gasto y marca el pago como hecho. */
  async function registerPayment(paymentId: string, input: ExpenseInput) {
    const id = await guardarGasto(input)
    await markPaymentDone(paymentId, id)
  }
  async function markPaymentDone(paymentId: string, expenseId: string) {
    const { error: e } = await supabase.from('detected_payments').update({ status: 'done', expense_id: expenseId }).eq('id', paymentId)
    fail(e)
    await loadAll()
  }
  async function dismissPayment(paymentId: string) {
    const { error: e } = await supabase.from('detected_payments').update({ status: 'dismissed' }).eq('id', paymentId)
    fail(e)
    await loadAll()
  }
  /** Un pago descartado vuelve a "pendiente" (Deshacer o Recuperar en Ajustes). */
  async function restorePayment(paymentId: string) {
    const { error: e } = await supabase.from('detected_payments').update({ status: 'pending', expense_id: null }).eq('id', paymentId)
    fail(e)
    await loadAll()
  }
  /** Últimos pagos descartados, por si se descartó uno sin querer. */
  const dismissedPayments = computed(() =>
    detected.value.filter((d) => d.status === 'dismissed').sort((a, b) => (a.paid_at < b.paid_at ? 1 : -1)).slice(0, 10),
  )
  /** Crea el código secreto del atajo si aún no existe (o uno nuevo si se pide). */
  async function ensurePaymentToken(householdId: string, userId: string, renew = false) {
    if (paymentSettings.value && !renew) return
    const token = newToken()
    const { error: e } = paymentSettings.value
      ? await supabase.from('payment_settings').update({ token }).eq('user_id', userId)
      : await supabase.from('payment_settings').insert({ user_id: userId, household_id: householdId, token })
    fail(e)
    await loadAll()
  }
  async function setCardKind(card: string, kind: PaymentKind) {
    if (!paymentSettings.value) return
    const card_kinds = { ...paymentSettings.value.card_kinds, [card]: kind }
    const { error: e } = await supabase.from('payment_settings').update({ card_kinds }).eq('user_id', paymentSettings.value.user_id)
    fail(e)
    await loadAll()
  }
  /** Manda un pago de prueba por el mismo camino que usará el atajo. El importe es
   *  aleatorio para que dos pruebas seguidas no se descarten como repetidas. */
  async function sendTestPayment() {
    const token = paymentSettings.value?.token
    if (!token) throw new Error('Primero genera el código.')
    const cents = 100 + Math.floor(Math.random() * 900)
    const amount = `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')} €`
    const { data: result, error: e } = await supabase.rpc('register_payment', { p_token: token, p_amount: amount, p_merchant: 'Pago de prueba', p_card: 'Prueba' })
    fail(e)
    if (result === 'repetido') throw new Error('Se ha ignorado por repetido: mismo importe y comercio que otro pago de hace menos de dos minutos.')
    await loadAll()
  }

  // ---- avisos en el móvil ------------------------------------
  /** Los aparatos de este usuario donde están puestos los avisos (RLS: solo los suyos). */
  async function loadPushSubscriptions(): Promise<PushSubscriptionRow[]> {
    const { data: rows, error: e } = await supabase.from('push_subscriptions').select('*').order('created_at')
    fail(e)
    return (rows ?? []) as unknown as PushSubscriptionRow[]
  }

  async function savePushSubscription(row: Omit<PushSubscriptionRow, 'id' | 'created_at'>) {
    const { error: e } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' })
    fail(e)
  }

  async function removePushSubscription(endpoint: string) {
    const { error: e } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
    fail(e)
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
    expenses, shares, categories, settlements, goals, contributions, budgets, recurring, runs, loading, loaded, error, offline, snapshotAt,
    detected, paymentSettings, pendingPayments, dismissedPayments, partnerPending, paymentCards, kindForCard, kindForPayment, memoryFor, categoryForMerchant,
    registerPayment, markPaymentDone, dismissPayment, restorePayment, ensurePaymentToken, setCardKind, sendTestPayment,
    savedByGoal, sharesByExpense, categoryById, expensesWithShares, potBudget, myBudget, setBudget,
    pendingRuns, lastAmountOf, addRecurring, updateRecurring, deleteRecurring, resolvePending, skipPending,
    loadAll, ensureLoaded, refreshIfStale, refreshPayments, reset,
    saveExpense, setExpensePublic, deleteExpense, reinsertExpense,
    loadPushSubscriptions, savePushSubscription, removePushSubscription, notifyPartner, testPushDelivery,
    addCategory, updateCategory, reorderCategories, deleteCategory, moveCategory,
    addSettlement, deleteSettlement,
    addGoal, updateGoal, deleteGoal,
    addContribution, updateContribution, deleteContribution,
  }
}
