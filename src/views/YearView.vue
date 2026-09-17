<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData } from '../composables/useData'
import { useMonth } from '../composables/useMonth'
import { formatEur, monthOf, round2, shortMonth, sum, todayIso, totalsBy, totalsByMonth } from '../lib/money'
import { myItems } from '../lib/insights'
import SegmentedControl from '../components/SegmentedControl.vue'
import CategoryIcon from '../components/CategoryIcon.vue'
import MonthlyBars from '../components/MonthlyBars.vue'
import DonutChart from '../components/DonutChart.vue'
import UiIcon from '../components/UiIcon.vue'

// Resumen del año: total por mes, por categoría y lo ahorrado en huchas.
// "Yo" es lo mío (personal + mi parte de repartidos + mi % de la conjunta);
// "Pareja" son los repartidos y la cuenta conjunta enteros.
type Scope = 'yo' | 'pareja'

const { state, me, partner } = useSession()
const data = useData()
const { month } = useMonth()

onMounted(() => data.ensureLoaded(state.user?.id))

const year = ref(Number(month.value.slice(0, 4)))
const scope = ref<Scope>('yo')
const scopes: Array<{ value: Scope; label: string }> = [
  { value: 'yo', label: 'Yo' },
  { value: 'pareja', label: 'Pareja' },
]
const thisYear = Number(todayIso().slice(0, 4))
const months = computed(() => Array.from({ length: 12 }, (_, i) => `${year.value}-${String(i + 1).padStart(2, '0')}`))
const labels = computed(() => months.value.map(shortMonth))
const highlight = computed(() => (year.value === thisYear ? Number(todayIso().slice(5, 7)) - 1 : undefined))
/** Meses del año que ya han empezado (para la media). */
const monthsSoFar = computed(() => (year.value < thisYear ? 12 : year.value > thisYear ? 0 : Number(todayIso().slice(5, 7))))

const userId = computed(() => state.user!.id)
const rows = computed(() => data.expensesWithShares.value.filter((e) => e.spent_on.startsWith(`${year.value}-`)))

interface Item { spent_on: string; amount: number; category_id: string }
const mine = computed<Item[]>(() => myItems(rows.value, userId.value, (me.value?.share_pct ?? 50) / 100))
const split = computed(() => rows.value.filter((e) => e.is_shared && e.funding === 'personal'))
const pot = computed<Item[]>(() => rows.value.filter((e) => e.is_shared && e.funding === 'pot'))
const items = computed<Item[]>(() => (scope.value === 'yo' ? mine.value : [...split.value, ...pot.value]))

const total = computed(() => sum(items.value.map((x) => x.amount)))
const perMonth = computed(() => totalsByMonth(items.value, months.value))
const average = computed(() => {
  const withData = perMonth.value.slice(0, monthsSoFar.value).filter((v) => v > 0)
  return withData.length ? round2(sum(withData) / withData.length) : 0
})
const topMonth = computed(() => {
  const i = perMonth.value.indexOf(Math.max(...perMonth.value))
  return perMonth.value[i] > 0 ? { label: labels.value[i], value: perMonth.value[i] } : null
})

const bars = computed(() =>
  scope.value === 'yo'
    ? [{ label: 'Lo mío', values: perMonth.value }]
    : [
        { label: 'Repartido', values: totalsByMonth(split.value, months.value), color: cssColor('--pareja') },
        { label: 'Conjunta', values: totalsByMonth(pot.value, months.value), color: cssColor('--yo') },
      ],
)
function cssColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#5b4f8f'
}

const byCategory = computed(() => totalsBy(items.value, (x) => x.category_id, (x) => x.amount))
const donut = computed(() =>
  byCategory.value.map((c) => ({
    label: data.categoryById.value[c.key]?.name ?? 'Otros',
    value: c.total,
    color: data.categoryById.value[c.key]?.color ?? '#7a857f',
  })),
)

// Pareja: cuánto ha pagado cada uno en repartidos
const paidBy = computed(() =>
  state.members.map((m) => ({ name: m.display_name, total: sum(split.value.filter((e) => e.user_id === m.user_id).map((e) => e.amount)) })),
)

// Huchas: lo metido menos lo sacado durante el año
const goals = computed(() => {
  const list = data.goals.value.filter((g) => (scope.value === 'yo' ? !g.is_shared && g.user_id === userId.value : g.is_shared))
  return list
    .map((g) => ({
      goal: g,
      net: round2(
        data.contributions.value
          .filter((c) => c.goal_id === g.id && monthOf(c.contributed_on).startsWith(`${year.value}-`))
          .reduce((a, c) => a + (c.direction === 'out' ? -c.amount : c.amount), 0),
      ),
    }))
    .filter((x) => x.net !== 0)
    .sort((a, b) => b.net - a.net)
})
const savedTotal = computed(() => round2(goals.value.reduce((a, g) => a + g.net, 0)))
</script>

<template>
  <div :class="scope === 'yo' ? 'space-yo' : 'space-pareja'" class="stack">
    <div class="row between">
      <h1>Resumen del año</h1>
      <div class="row" style="gap: 0.1rem">
        <button type="button" class="icon" aria-label="Año anterior" @click="year--">‹</button>
        <strong class="tnum" style="min-width: 3.2rem; text-align: center">{{ year }}</strong>
        <button type="button" class="icon" aria-label="Año siguiente" :disabled="year >= thisYear" @click="year++">›</button>
      </div>
    </div>

    <SegmentedControl v-model="scope" :options="scopes" />

    <div class="card accent">
      <div class="tiny" style="text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700">
        {{ scope === 'yo' ? 'Lo mío en' : 'Repartido + conjunta en' }} {{ year }}
      </div>
      <div class="hero-number" style="margin: 0.2rem 0">{{ formatEur(total) }}</div>
      <div class="hero-split">
        <div><div class="label">Media al mes</div><div class="value">{{ formatEur(average) }}</div></div>
        <div v-if="topMonth"><div class="label">Mes más alto</div><div class="value">{{ topMonth.label }} · {{ formatEur(topMonth.value) }}</div></div>
        <div v-if="scope === 'pareja'"><div class="label">Conjunta</div><div class="value">{{ formatEur(sum(pot.map((x) => x.amount))) }}</div></div>
        <div v-else><div class="label">Ahorrado</div><div class="value">{{ formatEur(savedTotal) }}</div></div>
      </div>
    </div>

    <div class="card">
      <div class="row between" style="margin-bottom: 0.4rem">
        <h2>Mes a mes</h2>
        <span v-if="scope === 'pareja'" class="row tiny" style="gap: 0.8rem">
          <span><span class="dot-legend" style="background: var(--pareja)" /> Repartido</span>
          <span><span class="dot-legend" style="background: var(--yo)" /> Conjunta</span>
        </span>
      </div>
      <MonthlyBars :labels="labels" :datasets="bars" :average="scope === 'yo'" :highlight="highlight" :stacked="scope === 'pareja'" :height="190" />
    </div>

    <div v-if="scope === 'pareja' && partner" class="card">
      <div class="kpis">
        <div v-for="p in paidBy" :key="p.name" class="kpi">
          <div class="label">Pagó {{ p.name }} (repartidos)</div>
          <div class="value">{{ formatEur(p.total) }}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <h2 style="margin-bottom: 0.4rem">Por categoría</h2>
      <template v-if="byCategory.length">
        <DonutChart :items="donut" :total="total" :caption="String(year)" />
        <ul class="list" style="margin-top: 0.6rem">
          <li v-for="c in byCategory" :key="c.key">
            <CategoryIcon :icon="data.categoryById.value[c.key]?.icon" :emoji="data.categoryById.value[c.key]?.emoji" :color="data.categoryById.value[c.key]?.color" />
            <div class="grow">
              <div class="ellipsis"><strong>{{ data.categoryById.value[c.key]?.name ?? 'Otros' }}</strong></div>
              <div class="tiny">{{ Math.round((c.total / total) * 100) }} % · {{ formatEur(round2(c.total / Math.max(1, monthsSoFar))) }} al mes</div>
            </div>
            <span class="amount">{{ formatEur(c.total) }}</span>
          </li>
        </ul>
      </template>
      <div v-else class="empty">Sin gastos en {{ year }}.</div>
    </div>

    <div class="card">
      <h2 style="margin-bottom: 0.4rem">{{ scope === 'yo' ? 'Mis huchas' : 'Huchas en pareja' }} en {{ year }}</h2>
      <ul v-if="goals.length" class="list">
        <li v-for="g in goals" :key="g.goal.id">
          <span class="emoji-badge" :style="{ '--badge': g.goal.color }">{{ g.goal.emoji }}</span>
          <div class="grow ellipsis"><strong>{{ g.goal.name }}</strong></div>
          <span class="amount" :class="{ neg: g.net < 0, pos: g.net > 0 }">{{ g.net > 0 ? '+' : '' }}{{ formatEur(g.net) }}</span>
        </li>
        <li>
          <span class="emoji-badge"><UiIcon name="wallet" /></span>
          <div class="grow"><strong>Total ahorrado este año</strong></div>
          <span class="amount">{{ formatEur(savedTotal) }}</span>
        </li>
      </ul>
      <div v-else class="empty">Ningún movimiento en huchas este año.</div>
    </div>
  </div>
</template>
