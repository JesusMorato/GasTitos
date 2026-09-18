// Estado del editor de gastos, compartido entre el botón ➕ de la barra
// inferior (App.vue) y las vistas que editan gastos existentes.
import { reactive } from 'vue'
import type { Expense } from '../types'
import type { Share } from '../lib/money'

export type Kind = 'personal' | 'shared' | 'pot'
export type ExpenseRow = Expense & { shares: Share[] }
/** Valores con los que abrir un gasto nuevo ya rellenado (p. ej. desde un pago detectado). */
export interface Prefill {
  amount?: number
  description?: string
  spent_on?: string
  category_id?: string
}

const state = reactive<{
  quickOpen: boolean
  formOpen: boolean
  preset: Kind
  editing: ExpenseRow | undefined
  prefill: Prefill | undefined
  /** Pago detectado del que sale este gasto: al guardar se marca como apuntado. */
  fromPayment: string | null
  /** Guardando en el servidor: el formulario sigue abierto con el botón desactivado. */
  saving: boolean
  toast: string | null
}>({
  quickOpen: false,
  formOpen: false,
  preset: 'personal',
  editing: undefined,
  prefill: undefined,
  fromPayment: null,
  saving: false,
  toast: null,
})

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function useEditor() {
  function openQuick() {
    state.quickOpen = true
  }
  function openNew(preset: Kind, opts?: { prefill?: Prefill; fromPayment?: string }) {
    state.quickOpen = false
    state.editing = undefined
    state.prefill = opts?.prefill
    state.fromPayment = opts?.fromPayment ?? null
    state.preset = preset
    state.formOpen = true
  }
  function openEdit(row: ExpenseRow) {
    state.editing = row
    state.prefill = undefined
    state.fromPayment = null
    state.preset = !row.is_shared ? 'personal' : row.funding === 'pot' ? 'pot' : 'shared'
    state.formOpen = true
  }
  function close() {
    if (state.saving) return
    state.quickOpen = false
    state.formOpen = false
    state.editing = undefined
    state.prefill = undefined
    state.fromPayment = null
  }
  function toast(msg: string) {
    state.toast = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (state.toast = null), 3500)
  }
  return { state, openQuick, openNew, openEdit, close, toast }
}
