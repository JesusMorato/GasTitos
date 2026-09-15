export interface Household {
  id: string
  name: string
  invite_code: string
  created_at: string
}

export interface Member {
  household_id: string
  user_id: string
  display_name: string
  share_pct: number
  joined_at: string
}

export interface Category {
  id: string
  household_id: string
  name: string
  emoji: string
  color: string
  /** Clave del icono del juego propio (ver lib/icons.ts). null = se usa el emoji. */
  icon: string | null
  sort_order: number
}

export type Funding = 'personal' | 'pot'
export type SplitMode = 'household' | 'equal' | 'custom' | 'exact' | 'other_only'

export interface ExpenseShare {
  expense_id: string
  user_id: string
  amount: number
}

export interface Expense {
  id: string
  household_id: string
  /** Quién lo ha pagado. En gastos del bote, quién lo apuntó. */
  user_id: string
  amount: number
  spent_on: string
  category_id: string
  description: string | null
  is_shared: boolean
  is_public: boolean
  funding: Funding
  split_mode: SplitMode
  created_at: string
}

export interface Settlement {
  id: string
  household_id: string
  from_user: string
  to_user: string
  amount: number
  settled_on: string
  note: string | null
  created_at: string
}

export interface SavingsGoal {
  id: string
  household_id: string
  user_id: string
  name: string
  emoji: string
  color: string
  target_amount: number
  deadline: string | null
  is_shared: boolean
  is_public: boolean
  created_at: string
}

export interface Contribution {
  id: string
  goal_id: string
  user_id: string
  amount: number
  contributed_on: string
  note: string | null
  created_at: string
}

/** Colores disponibles para categorías y huchas. */
export const PALETTE = [
  '#2f6f5e', '#3a8f8f', '#5b7fa6', '#3c7bd1', '#6b6bc4', '#b05aa0',
  '#d0587a', '#c8553d', '#c48a2e', '#4f9a6a', '#7a857f', '#8a6d4b',
] as const

/** Emojis sugeridos en el selector. Se puede escribir cualquier otro. */
export const EMOJI_SUGGESTIONS = [
  '🏠', '🍽️', '🛒', '☕', '🍕', '🍺', '🚌', '🚗', '⛽', '🚲', '✈️', '🏖️',
  '🎉', '🎬', '🎮', '🎵', '📚', '💊', '🏥', '🏋️', '👕', '👟', '💄', '🎁',
  '📱', '💻', '📺', '🔌', '💡', '🧾', '🐶', '🐱', '👶', '🎓', '💍', '🛋️',
  '🛠️', '🌱', '🎯', '🛟', '💰', '🏦', '🚀', '🏡', '🚙', '🎄', '⛷️', '🏕️',
] as const
