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
  joined_at: string
}

export interface Expense {
  id: string
  household_id: string
  user_id: string
  amount: number
  spent_on: string
  category: string
  description: string | null
  is_shared: boolean
  is_public: boolean
  created_at: string
}

export interface SavingsGoal {
  id: string
  household_id: string
  user_id: string
  name: string
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

export const CATEGORIES = [
  'Casa',
  'Comida',
  'Transporte',
  'Ocio',
  'Salud',
  'Ropa',
  'Regalos',
  'Viajes',
  'Suscripciones',
  'Otros',
] as const

export type Category = (typeof CATEGORIES)[number]
