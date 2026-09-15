<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Category, Expense, Member, SplitMode } from '../types'
import { computeShares, formatEur, round2, sharesAreValid, todayIso, type Share } from '../lib/money'
import type { ExpenseInput } from '../composables/useData'
import Sheet from './Sheet.vue'
import SegmentedControl from './SegmentedControl.vue'

type Kind = 'personal' | 'shared' | 'pot'

const props = defineProps<{
  preset: Kind
  members: readonly Member[]
  categories: readonly Category[]
  currentUserId: string
  initial?: Expense & { shares: Share[] }
}>()
const emit = defineEmits<{ (e: 'save', v: ExpenseInput): void; (e: 'close'): void }>()

const partner = computed(() => props.members.find((m) => m.user_id !== props.currentUserId) ?? null)
const me = computed(() => props.members.find((m) => m.user_id === props.currentUserId) ?? null)

function kindOf(x?: Expense): Kind {
  if (!x) return props.preset
  if (!x.is_shared) return 'personal'
  return x.funding === 'pot' ? 'pot' : 'shared'
}

const kind = ref<Kind>(kindOf(props.initial))
const amount = ref<number>(props.initial?.amount ?? 0)
const spentOn = ref(props.initial?.spent_on ?? todayIso())
const categoryId = ref(props.initial?.category_id ?? props.categories[0]?.id ?? '')
const description = ref(props.initial?.description ?? '')
const paidBy = ref(props.initial?.is_shared && props.initial.funding === 'personal' ? props.initial.user_id : props.currentUserId)
const splitMode = ref<SplitMode>(props.initial?.split_mode ?? 'household')
const customPct = ref<number>(initialCustomPct())
const exact = ref<Record<string, number>>(initialExact())
const error = ref<string | null>(null)

function initialCustomPct(): number {
  const x = props.initial
  if (x?.split_mode === 'custom' && x.amount > 0) {
    const mine = x.shares.find((s) => s.user_id === x.user_id)?.amount ?? 0
    return Math.round((mine / x.amount) * 100)
  }
  return 50
}
function initialExact(): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of props.members) out[m.user_id] = props.initial?.shares.find((s) => s.user_id === m.user_id)?.amount ?? 0
  return out
}

const kindOptions = computed(() => {
  const opts: Array<{ value: Kind; label: string }> = [{ value: 'personal', label: 'Personal' }]
  if (partner.value) opts.push({ value: 'shared', label: 'Repartido' })
  opts.push({ value: 'pot', label: 'Bote' })
  return opts
})

const splitOptions = computed<Array<{ value: SplitMode; label: string }>>(() => {
  const hh = me.value && partner.value ? `${Math.round(me.value.share_pct)}/${Math.round(partner.value.share_pct)}` : ''
  const other = props.members.find((m) => m.user_id !== paidBy.value)
  return [
    { value: 'household', label: `Hogar ${hh}` },
    { value: 'equal', label: 'A medias' },
    { value: 'custom', label: 'Porcentaje' },
    { value: 'exact', label: 'Importes' },
    { value: 'other_only', label: `Solo ${other?.display_name ?? 'el otro'}` },
  ]
})

const shares = computed<Share[]>(() =>
  computeShares(Number(amount.value) || 0, splitMode.value, props.members, paidBy.value, {
    customPct: Number(customPct.value),
    exact: exact.value,
  }),
)

// En "importes exactos", al escribir uno se rellena el otro automáticamente.
function onExact(userId: string, ev: Event) {
  const v = Number((ev.target as HTMLInputElement).value) || 0
  const next = { ...exact.value, [userId]: round2(v) }
  const other = props.members.find((m) => m.user_id !== userId)
  if (other) next[other.user_id] = round2(Math.max(0, (Number(amount.value) || 0) - round2(v)))
  exact.value = next
}
watch(amount, () => {
  if (splitMode.value === 'exact' && me.value && partner.value) {
    const mine = exact.value[me.value.user_id] ?? 0
    exact.value = { ...exact.value, [partner.value.user_id]: round2(Math.max(0, (Number(amount.value) || 0) - mine)) }
  }
})

function nameOf(id: string) {
  return props.members.find((m) => m.user_id === id)?.display_name ?? '—'
}

function submit() {
  error.value = null
  const a = Number(amount.value)
  if (!(a > 0)) {
    error.value = 'El importe tiene que ser mayor que 0.'
    return
  }
  if (!categoryId.value) {
    error.value = 'Elige una categoría.'
    return
  }
  const base = {
    id: props.initial?.id,
    amount: round2(a),
    spent_on: spentOn.value,
    category_id: categoryId.value,
    description: description.value.trim() || null,
  }
  if (kind.value === 'personal') {
    emit('save', { ...base, is_shared: false, is_public: props.initial?.is_public ?? false, funding: 'personal', split_mode: 'household' })
    return
  }
  if (kind.value === 'pot') {
    emit('save', { ...base, is_shared: true, funding: 'pot', split_mode: 'household' })
    return
  }
  if (!sharesAreValid(round2(a), shares.value)) {
    error.value = 'Las partes no suman el importe.'
    return
  }
  emit('save', {
    ...base,
    is_shared: true,
    funding: 'personal',
    split_mode: splitMode.value,
    paid_by: paidBy.value,
    shares: shares.value,
  })
}
</script>

<template>
  <Sheet :title="initial ? 'Editar gasto' : 'Nuevo gasto'" @close="emit('close')">
    <form @submit.prevent="submit">
      <div class="field">
        <SegmentedControl v-model="kind" :options="kindOptions" />
        <p class="help">
          <template v-if="kind === 'personal'">Solo tuyo. Privado salvo que lo hagas público.</template>
          <template v-else-if="kind === 'shared'">Lo paga uno con su dinero y se reparte.</template>
          <template v-else>Pagado con la cuenta conjunta. No se reparte.</template>
        </p>
      </div>

      <div class="field amount-input">
        <label for="amount">Importe</label>
        <input id="amount" v-model.number="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="0,00" required autofocus />
      </div>

      <div class="field">
        <label>Categoría</label>
        <div class="chips">
          <button
            v-for="c in categories"
            :key="c.id"
            type="button"
            class="chip"
            :class="{ active: c.id === categoryId }"
            @click="categoryId = c.id"
          ><span>{{ c.emoji }}</span>{{ c.name }}</button>
        </div>
      </div>

      <div class="grid2">
        <div class="field">
          <label for="date">Fecha</label>
          <input id="date" v-model="spentOn" type="date" required />
        </div>
        <div class="field">
          <label for="desc">Nota (opcional)</label>
          <input id="desc" v-model="description" maxlength="120" placeholder="Cena del viernes" />
        </div>
      </div>

      <template v-if="kind === 'shared' && partner">
        <div class="field">
          <label>¿Quién lo ha pagado?</label>
          <div class="chips">
            <button
              v-for="m in members"
              :key="m.user_id"
              type="button"
              class="chip"
              :class="{ active: m.user_id === paidBy }"
              @click="paidBy = m.user_id"
            >{{ m.display_name }}</button>
          </div>
        </div>

        <div class="field">
          <label>¿Cómo se reparte?</label>
          <div class="chips">
            <button
              v-for="o in splitOptions"
              :key="o.value"
              type="button"
              class="chip"
              :class="{ active: o.value === splitMode }"
              @click="splitMode = o.value"
            >{{ o.label }}</button>
          </div>
        </div>

        <div v-if="splitMode === 'custom'" class="field">
          <label for="pct">Parte de {{ nameOf(paidBy) }} (%)</label>
          <input id="pct" v-model.number="customPct" type="number" min="0" max="100" step="1" inputmode="numeric" />
          <input v-model.number="customPct" type="range" min="0" max="100" step="5" aria-label="Porcentaje" style="padding: 0; margin-top: 0.4rem" />
        </div>

        <div v-if="splitMode === 'exact'" class="grid2">
          <div v-for="m in members" :key="m.user_id" class="field">
            <label :for="'exact-' + m.user_id">Parte de {{ m.display_name }} (€)</label>
            <input
              :id="'exact-' + m.user_id"
              type="number"
              step="0.01"
              min="0"
              inputmode="decimal"
              :value="exact[m.user_id] ?? 0"
              @input="onExact(m.user_id, $event)"
            />
          </div>
        </div>

        <p class="help tnum">
          <template v-for="(s, i) in shares" :key="s.user_id">
            <span v-if="i > 0"> · </span>{{ nameOf(s.user_id) }} <strong>{{ formatEur(s.amount) }}</strong>
          </template>
        </p>
      </template>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="row" style="justify-content: flex-end; margin-top: 0.5rem">
        <button type="button" class="ghost" @click="emit('close')">Cancelar</button>
        <button type="submit">Guardar</button>
      </div>
    </form>
  </Sheet>
</template>
