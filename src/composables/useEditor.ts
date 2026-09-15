// Estado del editor de gastos, compartido entre el botón ➕ de la barra
// inferior (App.vue) y las vistas que editan gastos existentes.
import { reactive } from 'vue'
import type { Expense } from '../types'
import type { Share } from '../lib/money'

export type Kind = 'personal' | 'shared' | 'pot'
export type ExpenseRow = Expense & { shares: Share[] }

const state = reactive<{
  quickOpen: boolean
  formOpen: boolean
  preset: Kind
  editing: ExpenseRow | undefined
  toast: string | null
}>({
  quickOpen: false,
  formOpen: false,
  preset: 'personal',
  editing: undefined,
  toast: null,
})

let toastTimer: ReturnType<typeof setTimeout> | undefined

export function useEditor() {
  function openQuick() {
    state.quickOpen = true
  }
  function openNew(preset: Kind) {
    state.quickOpen = false
    state.editing = undefined
    state.preset = preset
    state.formOpen = true
  }
  function openEdit(row: ExpenseRow) {
    state.editing = row
    state.preset = !row.is_shared ? 'personal' : row.funding === 'pot' ? 'pot' : 'shared'
    state.formOpen = true
  }
  function close() {
    state.quickOpen = false
    state.formOpen = false
    state.editing = undefined
  }
  function toast(msg: string) {
    state.toast = msg
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => (state.toast = null), 3500)
  }
  return { state, openQuick, openNew, openEdit, close, toast }
}
