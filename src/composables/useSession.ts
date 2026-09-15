// Estado global de sesión: usuario, hogar y miembros.
// Es un "composable" sencillo con reactive(); no hace falta Pinia para dos usuarios.
import { computed, reactive, readonly } from 'vue'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Household, Member } from '../types'

interface State {
  ready: boolean
  user: User | null
  household: Household | null
  members: Member[]
  error: string | null
}

const state = reactive<State>({
  ready: false,
  user: null,
  household: null,
  members: [],
  error: null,
})

let initialised = false

async function loadHousehold() {
  if (!state.user) {
    state.household = null
    state.members = []
    return
  }
  const { data: members, error } = await supabase.from('household_members').select('*')
  if (error) {
    state.error = error.message
    return
  }
  state.members = (members ?? []) as Member[]
  const mine = state.members.find((m) => m.user_id === state.user?.id)
  if (!mine) {
    state.household = null
    return
  }
  const { data: h } = await supabase.from('households').select('*').eq('id', mine.household_id).single()
  state.household = (h as Household) ?? null
}

async function applySession(session: Session | null) {
  state.user = session?.user ?? null
  await loadHousehold()
  state.ready = true
}

export function useSession() {
  if (!initialised) {
    initialised = true
    supabase.auth.getSession().then(({ data }) => applySession(data.session))
    supabase.auth.onAuthStateChange((_event, session) => {
      // No hacemos await aquí: Supabase recomienda no bloquear este callback.
      applySession(session)
    })
  }

  const me = computed(() => state.members.find((m) => m.user_id === state.user?.id) ?? null)
  const partner = computed(() => state.members.find((m) => m.user_id !== state.user?.id) ?? null)

  function nameOf(userId: string): string {
    return state.members.find((m) => m.user_id === userId)?.display_name ?? 'Alguien'
  }

  async function signOut() {
    await supabase.auth.signOut()
    state.user = null
    state.household = null
    state.members = []
  }

  return {
    state: readonly(state),
    me,
    partner,
    nameOf,
    refresh: loadHousehold,
    signOut,
  }
}
