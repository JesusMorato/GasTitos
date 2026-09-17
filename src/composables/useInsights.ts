// Datos del cerdito: calcula los consejos con lo que ya hay cargado y recuerda
// (en este navegador) cuáles se han visto, para el puntito del botón.
import { computed, ref, watch } from 'vue'
import { useData } from './useData'
import { useSession } from './useSession'
import { computeInsights, insightsSignature, myItems } from '../lib/insights'
import { round2, sum, todayIso } from '../lib/money'

const seen = ref('')

function storageKey(userId: string) {
  return `gastitos:cerdito-visto:${userId}`
}

export function useInsights() {
  const data = useData()
  const { state, me } = useSession()

  const userId = computed(() => state.user?.id ?? '')

  const insights = computed(() => {
    if (!userId.value || !data.loaded.value) return []
    const uid = userId.value
    const today = todayIso()
    const items = myItems(data.expensesWithShares.value, uid, (me.value?.share_pct ?? 50) / 100)
    const fixedMonthly = round2(sum(
      data.recurring.value
        .filter((r) => r.kind === 'personal' && r.user_id === uid && r.active && r.amount != null)
        .map((r) => r.amount! / r.every_n_months),
    ))
    const goals = data.goals.value
      .filter((g) => !g.is_shared && g.user_id === uid)
      .map((g) => ({ name: g.name, target: g.target_amount, saved: data.savedByGoal.value[g.id] ?? 0, deadline: g.deadline }))
    return computeInsights({
      items,
      today,
      categoryName: (id) => data.categoryById.value[id]?.name ?? 'Otros',
      limit: data.myBudget(uid)?.monthly_limit ?? null,
      fixedMonthly,
      goals,
    })
  })

  const signature = computed(() => insightsSignature(insights.value, todayIso()))

  watch(
    userId,
    (uid) => {
      try {
        seen.value = uid ? localStorage.getItem(storageKey(uid)) ?? '' : ''
      } catch {
        seen.value = ''
      }
    },
    { immediate: true },
  )

  /** Hay algo importante que aún no se ha visto. */
  const hasNews = computed(() => signature.value !== '' && signature.value !== seen.value)

  function markSeen() {
    seen.value = signature.value
    try {
      if (userId.value) localStorage.setItem(storageKey(userId.value), signature.value)
    } catch {
      // Sin almacenamiento (modo privado): el punto volverá a salir, no pasa nada.
    }
  }

  return { insights, hasNews, markSeen }
}
