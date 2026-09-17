<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Category, Member, RecurringExpense, RecurringKind } from '../types'
import { monthOf, todayIso } from '../lib/money'
import type { RecurringInput } from '../composables/useData'
import Sheet from './Sheet.vue'
import SegmentedControl from './SegmentedControl.vue'
import CategoryIcon from './CategoryIcon.vue'

const props = defineProps<{
  members: readonly Member[]
  categories: readonly Category[]
  currentUserId: string
  initial?: RecurringExpense
  /** Tipo fijado desde fuera (p. ej. "personal" desde la vista Yo): no se muestra el selector. */
  fixedKind?: RecurringKind
}>()
const emit = defineEmits<{ (e: 'save', v: RecurringInput): void; (e: 'close'): void }>()

const partner = computed(() => props.members.find((m) => m.user_id !== props.currentUserId) ?? null)
const me = computed(() => props.members.find((m) => m.user_id === props.currentUserId) ?? null)

const name = ref(props.initial?.name ?? '')
const kind = ref<RecurringKind>(props.fixedKind ?? props.initial?.kind ?? 'pot')
const categoryId = ref(props.initial?.category_id ?? props.categories[0]?.id ?? '')
const variable = ref(props.initial ? props.initial.amount == null : false)
const amount = ref<number>(props.initial?.amount ?? 0)
const every = ref<number>(props.initial?.every_n_months ?? 1)
const startMonth = ref(props.initial?.start_month ?? monthOf(todayIso()))
const paidBy = ref(props.initial?.kind === 'shared' ? props.initial.user_id : props.currentUserId)
const splitMode = ref<RecurringExpense['split_mode']>(props.initial?.split_mode ?? 'household')
const customPct = ref<number>(props.initial?.custom_pct ?? 50)
const error = ref<string | null>(null)

const kindOptions = computed(() => {
  const opts: Array<{ value: RecurringKind; label: string }> = [{ value: 'pot', label: 'Conjunta' }]
  if (partner.value) opts.push({ value: 'shared', label: 'Repartido' })
  opts.push({ value: 'personal', label: 'Personal' })
  return opts
})
const everyOptions = [
  { value: 1, label: 'Cada mes' },
  { value: 2, label: 'Cada 2 meses' },
  { value: 3, label: 'Cada 3 meses' },
  { value: 6, label: 'Cada 6 meses' },
  { value: 12, label: 'Cada año' },
]
const splitOptions = computed(() => {
  const hh = me.value && partner.value ? `${Math.round(me.value.share_pct)}/${Math.round(partner.value.share_pct)}` : ''
  const isHalf = me.value?.share_pct === 50
  const other = props.members.find((m) => m.user_id !== paidBy.value)
  const opts: Array<{ value: RecurringExpense['split_mode']; label: string }> = [{ value: 'household', label: isHalf ? 'A medias' : `Hogar ${hh}` }]
  if (!isHalf) opts.push({ value: 'equal', label: 'A medias' })
  opts.push({ value: 'custom', label: 'Porcentaje' }, { value: 'other_only', label: `Solo ${other?.display_name ?? 'el otro'}` })
  return opts
})

function submit() {
  error.value = null
  if (!name.value.trim()) {
    error.value = 'Ponle un nombre (Alquiler, Luz…).'
    return
  }
  if (!variable.value && !(Number(amount.value) > 0)) {
    error.value = 'El importe tiene que ser mayor que 0, o marca "importe variable".'
    return
  }
  if (!/^\d{4}-\d{2}$/.test(startMonth.value)) {
    error.value = 'El mes de inicio no es válido.'
    return
  }
  emit('save', {
    name: name.value.trim(),
    category_id: categoryId.value,
    amount: variable.value ? null : Number(amount.value),
    kind: kind.value,
    split_mode: kind.value === 'shared' ? splitMode.value : 'household',
    custom_pct: kind.value === 'shared' && splitMode.value === 'custom' ? Number(customPct.value) : null,
    every_n_months: Number(every.value),
    start_month: startMonth.value,
    user_id: kind.value === 'shared' ? paidBy.value : props.currentUserId,
  })
}
</script>

<template>
  <Sheet :title="initial ? 'Editar gasto fijo' : fixedKind === 'personal' ? 'Nuevo gasto fijo personal' : 'Nuevo gasto fijo'" @close="emit('close')">
    <form @submit.prevent="submit">
      <div class="field">
        <label for="rname">Nombre</label>
        <input id="rname" v-model="name" required maxlength="60" :placeholder="kind === 'personal' ? 'Gimnasio, Spotify, Móvil…' : 'Alquiler, Luz, Wifi…'" />
      </div>

      <div class="field">
        <SegmentedControl v-if="!fixedKind" v-model="kind" :options="kindOptions" />
        <p class="help">
          <template v-if="kind === 'pot'">Sale de la cuenta conjunta.</template>
          <template v-else-if="kind === 'shared'">Lo paga uno con su dinero y se reparte.</template>
          <template v-else>Solo tuyo y privado: tu pareja no lo ve.</template>
        </p>
      </div>

      <div class="field">
        <label>Categoría</label>
        <div class="chips">
          <button v-for="c in categories" :key="c.id" type="button" class="chip" :class="{ active: c.id === categoryId }" @click="categoryId = c.id">
            <CategoryIcon variant="inline" :icon="c.icon" :emoji="c.emoji" :color="c.color" />{{ c.name }}
          </button>
        </div>
      </div>

      <div class="field">
        <label class="check"><input v-model="variable" type="checkbox" /> Importe variable (luz, gas, agua): cada vez me pedirá la cifra</label>
      </div>
      <div v-if="!variable" class="field amount-input">
        <label for="ramount">Importe fijo</label>
        <input id="ramount" v-model.number="amount" type="number" step="0.01" min="0.01" inputmode="decimal" placeholder="0,00" />
      </div>

      <div class="grid2">
        <div class="field">
          <label for="every">Frecuencia</label>
          <select id="every" v-model.number="every">
            <option v-for="o in everyOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="start">Desde el mes</label>
          <input id="start" v-model="startMonth" type="month" required />
        </div>
      </div>

      <template v-if="kind === 'shared' && partner">
        <div class="field">
          <label>¿Quién lo paga?</label>
          <div class="chips">
            <button v-for="m in members" :key="m.user_id" type="button" class="chip" :class="{ active: m.user_id === paidBy }" @click="paidBy = m.user_id">{{ m.display_name }}</button>
          </div>
        </div>
        <div class="field">
          <label>¿Cómo se reparte?</label>
          <div class="chips">
            <button v-for="o in splitOptions" :key="o.value" type="button" class="chip" :class="{ active: o.value === splitMode }" @click="splitMode = o.value">{{ o.label }}</button>
          </div>
        </div>
        <div v-if="splitMode === 'custom'" class="field">
          <label for="rpct">Parte de quien paga (%)</label>
          <input id="rpct" v-model.number="customPct" type="number" min="0" max="100" step="1" inputmode="numeric" />
        </div>
      </template>

      <p class="help">Sin día: al entrar en un mes nuevo, el gasto aparece solo con fecha día 1. Los variables quedan pendientes hasta que pongas el importe.</p>
      <p v-if="error" class="error">{{ error }}</p>

      <div class="row" style="justify-content: flex-end; margin-top: 0.5rem">
        <button type="button" class="ghost" @click="emit('close')">Cancelar</button>
        <button type="submit">Guardar</button>
      </div>
    </form>
  </Sheet>
</template>
