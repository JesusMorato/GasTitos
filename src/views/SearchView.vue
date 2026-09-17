<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useSession } from '../composables/useSession'
import { useData } from '../composables/useData'
import { useEditor, type ExpenseRow } from '../composables/useEditor'
import { useConfirm } from '../composables/useConfirm'
import { formatEur, formatMonth, sum } from '../lib/money'
import { EMPTY_FILTER, filterExpenses, groupByMonth, isEmptyFilter, type ExpenseKind, type SearchFilter } from '../lib/search'
import ExpenseList from '../components/ExpenseList.vue'
import CategoryIcon from '../components/CategoryIcon.vue'
import UiIcon from '../components/UiIcon.vue'

// Buscador de gastos de todos los meses: texto, categoría, tipo e importe.
const { state, nameOf } = useSession()
const data = useData()
const editor = useEditor()
const { confirm } = useConfirm()

onMounted(() => {
  data.ensureLoaded(state.user?.id)
  input.value?.focus()
})

const input = ref<HTMLInputElement | null>(null)
const filter = reactive<SearchFilter>({ ...EMPTY_FILTER, categoryIds: [], kinds: [] })
const showMore = ref(false)
const actionError = ref<string | null>(null)

const kinds: Array<{ value: ExpenseKind; label: string }> = [
  { value: 'personal', label: 'Personal' },
  { value: 'shared', label: 'Repartido' },
  { value: 'pot', label: 'Conjunta' },
]
function toggle<T>(list: T[], v: T) {
  const i = list.indexOf(v)
  if (i >= 0) list.splice(i, 1)
  else list.push(v)
}
function clear() {
  filter.text = ''
  filter.categoryIds.splice(0)
  filter.kinds.splice(0)
  filter.min = null
  filter.max = null
}

const empty = computed(() => isEmptyFilter(filter))
const results = computed(() =>
  empty.value ? [] : filterExpenses(data.expensesWithShares.value, filter, (id) => data.categoryById.value[id]?.name ?? ''),
)
const groups = computed(() => groupByMonth(results.value))
const total = computed(() => sum(results.value.map((r) => r.amount)))
/** Los gastos públicos de la pareja se ven pero no se editan. */
const mineOrShared = (rows: ExpenseRow[]) => rows.filter((r) => r.is_shared || r.user_id === state.user!.id)

async function run(fn: () => Promise<void>) {
  actionError.value = null
  try {
    await fn()
  } catch (e) {
    actionError.value = (e as Error).message
  }
}
async function deleteExpense(x: ExpenseRow) {
  if (await confirm({ title: 'Borrar gasto', message: `¿Borrar el gasto de ${formatEur(x.amount)}?` })) run(() => data.deleteExpense(x.id))
}
function togglePublic(x: ExpenseRow) {
  run(() => data.setExpensePublic(x.id, !x.is_public))
}
</script>

<template>
  <div class="space-yo stack">
    <h1>Buscar gastos</h1>

    <div class="card">
      <div class="field" style="margin-bottom: 0.6rem">
        <div class="search-box">
          <UiIcon name="search" :size="18" />
          <input ref="input" v-model="filter.text" type="search" placeholder="Nota o categoría: cena, súper, luz…" aria-label="Buscar" autocomplete="off" />
          <button v-if="filter.text" type="button" class="icon" aria-label="Borrar texto" @click="filter.text = ''"><UiIcon name="close" :size="16" /></button>
        </div>
      </div>

      <div class="chips" style="margin-bottom: 0.6rem">
        <button v-for="k in kinds" :key="k.value" type="button" class="chip" :class="{ active: filter.kinds.includes(k.value) }" @click="toggle(filter.kinds, k.value)">{{ k.label }}</button>
      </div>

      <button type="button" class="ghost small" style="padding-left: 0" @click="showMore = !showMore">
        <UiIcon :name="showMore ? 'chevronUp' : 'chevronDown'" :size="16" />
        {{ showMore ? 'Menos filtros' : 'Más filtros' }}
        <span v-if="!showMore && (filter.categoryIds.length || filter.min != null || filter.max != null)" class="tag" style="margin-left: 0.3rem">activos</span>
      </button>

      <template v-if="showMore">
        <div class="field" style="margin-top: 0.5rem">
          <label>Categorías</label>
          <div class="chips">
            <button v-for="c in data.categories.value" :key="c.id" type="button" class="chip" :class="{ active: filter.categoryIds.includes(c.id) }" @click="toggle(filter.categoryIds, c.id)">
              <CategoryIcon variant="inline" :icon="c.icon" :emoji="c.emoji" :color="c.color" />{{ c.name }}
            </button>
          </div>
        </div>
        <div class="grid2">
          <div class="field">
            <label for="min">Importe mínimo</label>
            <input id="min" v-model.number="filter.min" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Sin mínimo" />
          </div>
          <div class="field">
            <label for="max">Importe máximo</label>
            <input id="max" v-model.number="filter.max" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Sin máximo" />
          </div>
        </div>
      </template>

      <div v-if="!empty" class="row between" style="margin-top: 0.6rem">
        <span class="muted"><strong>{{ results.length }}</strong> {{ results.length === 1 ? 'gasto' : 'gastos' }} · <strong class="tnum">{{ formatEur(total) }}</strong></span>
        <button type="button" class="ghost small" @click="clear">Limpiar</button>
      </div>
    </div>

    <p v-if="actionError" class="error">{{ actionError }}</p>

    <div v-if="empty" class="empty card">Escribe algo o elige un filtro. Se busca en todos los meses.</div>
    <div v-else-if="results.length === 0" class="empty card">Ningún gasto coincide.</div>

    <div v-for="g in groups" :key="g.month" class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>{{ formatMonth(g.month) }}</h2>
        <span class="amount">{{ formatEur(g.total) }}</span>
      </div>
      <ExpenseList
        :expenses="mineOrShared(g.rows)"
        :category-by-id="data.categoryById.value"
        :name-of="nameOf"
        editable
        show-payer
        @edit="editor.openEdit"
        @delete="deleteExpense"
        @toggle-public="togglePublic"
      />
      <template v-if="mineOrShared(g.rows).length < g.rows.length">
        <p class="tiny" style="margin: 0.6rem 0 0.3rem">Públicos de tu pareja (solo lectura)</p>
        <ExpenseList :expenses="g.rows.filter((r) => !mineOrShared([r]).length)" :category-by-id="data.categoryById.value" :name-of="nameOf" :editable="false" />
      </template>
    </div>
  </div>
</template>

<style>
.search-box { display: flex; align-items: center; gap: 0.4rem; border: 1px solid var(--line); border-radius: var(--r-md); padding: 0 0.3rem 0 0.7rem; background: var(--surface); color: var(--ink-3); }
.search-box input { border: 0; padding-left: 0; background: transparent; }
.search-box input:focus { outline: none; }
.search-box:focus-within { border-color: var(--accent); }
</style>
