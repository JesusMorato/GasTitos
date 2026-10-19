<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../composables/useSession'
import { useData, type ExpenseInput } from '../composables/useData'
import { useEditor } from '../composables/useEditor'
import { computeShares, formatDate, formatEur, sum } from '../lib/money'
import { alreadyRecorded, decodeText, parseDelimited, parseStatement, suggestFromHistory, type Layout, type StatementItem } from '../lib/statement'
import { readXlsx } from '../lib/xlsx'
import { decryptOffice, isEncryptedOffice } from '../lib/officeCrypto'
import { linesToTable, passwordProblem, pdfToLines, PDF_LAYOUT } from '../lib/pdfStatement'
import type { PaymentKind } from '../types'
import UiIcon from '../components/UiIcon.vue'

// Importar un extracto del banco: se lee el archivo en el propio móvil (no se sube a
// ningún sitio), se enseñan los cargos y se apuntan los que el usuario marque.
// Cada uno con su tipo (Personal / Repartido / Conjunta) y su categoría; la app
// propone lo que se usó la última vez con un concepto parecido.

interface Row {
  item: StatementItem
  checked: boolean
  kind: PaymentKind
  category_id: string
  description: string
  /** Ya hay un gasto con la misma fecha e importe. */
  duplicate: boolean
  /** La categoría viene de un gasto anterior parecido. */
  remembered: boolean
}

const { state } = useSession()
const data = useData()
const editor = useEditor()
const router = useRouter()

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push({ name: 'settings' })
}

onMounted(() => data.ensureLoaded(state.user?.id))

const hasPartner = computed(() => state.members.length === 2)
const kinds = computed<Array<{ value: PaymentKind; label: string }>>(() => [
  { value: 'personal', label: 'Personal' },
  ...(hasPartner.value ? [{ value: 'shared' as PaymentKind, label: 'Repartido' }] : []),
  { value: 'pot', label: 'Conjunta' },
])

const fileName = ref('')
const rows = ref<Row[]>([])
const incomes = ref(0)
const skipped = ref(0)
const reading = ref(false)
const readError = ref<string | null>(null)
const saving = ref(false)
/** Excel o PDF con contraseña, a la espera de que el usuario la escriba. */
const locked = ref<{ buf: ArrayBuffer; kind: 'xlsx' | 'pdf' } | null>(null)
const password = ref('')
const passwordInput = ref<HTMLInputElement | null>(null)
const savedCount = ref(0)
const saveError = ref<string | null>(null)

const selected = computed(() => rows.value.filter((r) => r.checked))
const missingCategory = computed(() => selected.value.filter((r) => !r.category_id).length)
const total = computed(() => sum(selected.value.map((r) => r.item.amount)))
const duplicates = computed(() => rows.value.filter((r) => r.duplicate).length)

async function onFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  readError.value = null
  saveError.value = null
  rows.value = []
  locked.value = null
  password.value = ''
  fileName.value = file.name
  reading.value = true
  try {
    const buf = await file.arrayBuffer()
    const head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength)))
    if (head.startsWith('%PDF')) {
      await loadPdf(buf)
      return
    }
    if (isEncryptedOffice(buf)) {
      await askPassword(buf, 'xlsx')
      return
    }
    const name = file.name.toLowerCase()
    if (name.endsWith('.xls')) {
      throw new Error('Este Excel es del formato antiguo (.xls). Ábrelo y guárdalo como .xlsx o como CSV, y vuelve a subirlo.')
    }
    await loadTable(head.startsWith('PK') ? await readXlsx(buf) : parseDelimited(decodeText(buf)))
  } catch (e) {
    readError.value = (e as Error).message
  } finally {
    reading.value = false
  }
}

/** PDF: se saca el texto con pdf.js y de ahí los movimientos. Si pide contraseña, se pregunta. */
async function loadPdf(buf: ArrayBuffer, pwd?: string) {
  let lines: string[]
  try {
    lines = await pdfToLines(buf, pwd)
  } catch (e) {
    const problem = passwordProblem(e)
    if (problem === 'needed') return askPassword(buf, 'pdf')
    if (problem === 'wrong') throw new Error('Contraseña incorrecta')
    throw new Error('No he podido leer este PDF.')
  }
  const table = linesToTable(lines)
  if (!table) throw new Error('En este PDF no encuentro movimientos (líneas con fecha e importe). Si es un extracto escaneado, no se puede leer.')
  await loadTable(table, PDF_LAYOUT)
}

/** Archivo con contraseña: se pide y se sigue en openLocked. */
async function askPassword(buf: ArrayBuffer, kind: 'xlsx' | 'pdf') {
  locked.value = { buf, kind }
  reading.value = false
  await nextTick()
  passwordInput.value?.focus()
}

/** Abre el archivo con la contraseña escrita y sigue como con uno normal. */
async function openLocked() {
  if (!locked.value || !password.value || reading.value) return
  readError.value = null
  reading.value = true
  const { buf, kind } = locked.value
  try {
    if (kind === 'pdf') {
      await loadPdf(buf, password.value)
    } else {
      await loadTable(await readXlsx(await decryptOffice(buf, password.value)))
    }
    locked.value = null
    password.value = ''
  } catch (e) {
    readError.value = (e as Error).message
  } finally {
    reading.value = false
  }
}

async function loadTable(table: string[][], layout?: Layout) {
  const parsed = parseStatement(table, layout)
  if (!parsed) throw new Error('No he encontrado columnas de fecha e importe. Prueba con el CSV o el Excel que da el banco en "Exportar movimientos".')
  if (!parsed.items.length) throw new Error(parsed.incomes ? 'En este archivo solo hay ingresos; no hay cargos que apuntar.' : 'No he encontrado ningún cargo en el archivo.')
  const history = data.expenses.value
  rows.value = parsed.items.map((item) => {
    const hint = suggestFromHistory(item.concept, history)
    const duplicate = alreadyRecorded(item, history)
    return {
      item,
      checked: !duplicate,
      kind: hint && (hint.kind !== 'shared' || hasPartner.value) ? hint.kind : 'personal',
      category_id: hint?.category_id ?? '',
      description: item.concept,
      duplicate,
      remembered: !!hint,
    }
  })
  incomes.value = parsed.incomes
  skipped.value = parsed.skipped
}

function setAllKind(kind: PaymentKind) {
  for (const r of rows.value) r.kind = kind
}
function fillCategory(id: string) {
  if (!id) return
  for (const r of rows.value) if (!r.category_id) r.category_id = id
}
function toggleAll(on: boolean) {
  for (const r of rows.value) r.checked = on
}

function toInput(r: Row): ExpenseInput {
  const uid = state.user!.id
  const base = { amount: r.item.amount, spent_on: r.item.date, category_id: r.category_id, description: r.description.trim() || null }
  if (r.kind === 'shared') {
    return { ...base, is_shared: true, funding: 'personal', split_mode: 'household', paid_by: uid, shares: computeShares(r.item.amount, 'household', state.members, uid) }
  }
  return { ...base, is_shared: r.kind === 'pot', funding: r.kind === 'pot' ? 'pot' : 'personal', split_mode: 'household' }
}

async function save() {
  if (saving.value || !selected.value.length || missingCategory.value) return
  saving.value = true
  saveError.value = null
  savedCount.value = 0
  const batch = selected.value
  try {
    const n = await data.importExpenses(batch.map(toInput), (done) => { savedCount.value = done })
    editor.toast(n === 1 ? 'Gasto apuntado' : `${n} gastos apuntados`)
    router.push({ name: 'personal' })
  } catch (e) {
    // Los que sí entraron desaparecen de la lista para no apuntarlos dos veces.
    const done = new Set(batch.slice(0, savedCount.value))
    rows.value = rows.value.filter((r) => !done.has(r))
    saveError.value = `${savedCount.value ? `Se han apuntado ${savedCount.value}. ` : ''}Error: ${(e as Error).message}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="space-yo stack">
    <button type="button" class="back-link" @click="goBack"><UiIcon name="chevronLeft" :size="18" /> Volver</button>
    <h1>Importar un extracto</h1>

    <div class="card">
      <p class="tiny" style="margin-bottom: 0.6rem">
        Descarga los movimientos de tu banco (CSV, Excel o el extracto en PDF) y súbelos aquí. El archivo se lee en tu móvil, no se guarda en ningún sitio.
        Si lleva contraseña, se te pide. Solo se tienen en cuenta los cargos: los ingresos se ignoran.
      </p>
      <label class="btn secondary small file-btn">
        <UiIcon name="file" :size="16" /> {{ rows.length ? 'Elegir otro archivo' : 'Elegir archivo' }}
        <input type="file" accept=".csv,.txt,.tsv,.xlsx,.xls,.pdf,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="onFile" />
      </label>
      <span v-if="fileName" class="tiny" style="margin-left: 0.5rem">{{ fileName }}</span>
      <form v-if="locked" class="locked" @submit.prevent="openLocked">
        <p class="tiny" style="margin: 0.6rem 0 0.4rem">Este {{ locked.kind === 'pdf' ? 'PDF' : 'Excel' }} tiene contraseña (muchos bancos ponen el DNI o la fecha de nacimiento). Escríbela para abrirlo; se queda en tu móvil.</p>
        <div class="row">
          <input ref="passwordInput" v-model="password" type="password" class="grow" placeholder="Contraseña del archivo" autocomplete="off" :disabled="reading" />
          <button type="submit" class="small" :disabled="!password || reading">{{ reading ? 'Abriendo…' : 'Abrir' }}</button>
        </div>
      </form>
      <p v-if="reading && !locked" class="tiny" style="margin-top: 0.5rem">Leyendo…</p>
      <p v-if="readError" class="error" style="margin-top: 0.5rem">{{ readError }}</p>
      <p v-if="data.offline.value" class="error" style="margin-top: 0.5rem">Sin conexión no se pueden apuntar gastos.</p>
    </div>

    <template v-if="rows.length">
      <div class="card">
        <p class="muted" style="margin-bottom: 0.5rem">
          <strong>{{ rows.length }}</strong> cargos encontrados<template v-if="incomes">, {{ incomes }} ingresos ignorados</template><template v-if="skipped">, {{ skipped }} filas sin entender</template>.
          <template v-if="duplicates"> {{ duplicates === 1 ? 'Uno parece' : `${duplicates} parecen` }} ya apuntado{{ duplicates === 1 ? '' : 's' }} (misma fecha e importe) y {{ duplicates === 1 ? 'va' : 'van' }} sin marcar.</template>
        </p>
        <div class="field" style="margin-bottom: 0.6rem">
          <label>Tipo para todos</label>
          <div class="row">
            <button v-for="k in kinds" :key="k.value" type="button" class="small secondary" @click="setAllKind(k.value)">{{ k.label }}</button>
          </div>
        </div>
        <div class="field" style="margin-bottom: 0.4rem">
          <label for="fill-cat">Categoría para los que no tienen</label>
          <select id="fill-cat" @change="fillCategory(($event.target as HTMLSelectElement).value); ($event.target as HTMLSelectElement).value = ''">
            <option value="">Elegir…</option>
            <option v-for="c in data.categories.value" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="row">
          <button type="button" class="ghost small" @click="toggleAll(true)">Marcar todos</button>
          <button type="button" class="ghost small" @click="toggleAll(false)">Desmarcar todos</button>
        </div>
      </div>

      <div class="card">
        <ul class="list">
          <li v-for="r in rows" :key="r.item.key" class="imp" :class="{ off: !r.checked }">
            <label class="imp-head">
              <input v-model="r.checked" type="checkbox" />
              <div class="grow" style="min-width: 0">
                <input v-model="r.description" type="text" class="imp-desc" aria-label="Concepto" :disabled="!r.checked" />
                <div class="tiny">
                  {{ formatDate(r.item.date) }}
                  <span v-if="r.duplicate" class="tag warn">Parece apuntado</span>
                  <span v-else-if="r.remembered" class="tag muted">Como la última vez</span>
                </div>
              </div>
              <div class="amount">{{ formatEur(r.item.amount) }}</div>
            </label>
            <div v-if="r.checked" class="imp-opts">
              <div class="segmented small">
                <button v-for="k in kinds" :key="k.value" type="button" :class="{ active: r.kind === k.value }" @click="r.kind = k.value">{{ k.label }}</button>
              </div>
              <select v-model="r.category_id" :class="{ missing: !r.category_id }" aria-label="Categoría">
                <option value="" disabled>Categoría…</option>
                <option v-for="c in data.categories.value" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
          </li>
        </ul>
      </div>

      <div class="card">
        <p v-if="missingCategory" class="tiny" style="margin-bottom: 0.5rem">
          {{ missingCategory === 1 ? 'Falta la categoría de un gasto marcado.' : `Faltan las categorías de ${missingCategory} gastos marcados.` }}
        </p>
        <p v-if="saveError" class="error" style="margin-bottom: 0.5rem">{{ saveError }}</p>
        <button type="button" class="block" :disabled="saving || !selected.length || missingCategory > 0 || data.offline.value" @click="save">
          <template v-if="saving">Apuntando {{ savedCount }} de {{ selected.length }}…</template>
          <template v-else-if="!selected.length">Marca algún gasto</template>
          <template v-else>Apuntar {{ selected.length === 1 ? 'un gasto' : `${selected.length} gastos` }} · {{ formatEur(total) }}</template>
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.file-btn { position: relative; display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer; }
.file-btn input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.imp { display: block !important; }
.imp.off { opacity: 0.6; }
.imp-head { display: flex; gap: 0.6rem; align-items: center; min-width: 0; cursor: pointer; }
.imp-head input[type='checkbox'] { width: 20px; height: 20px; flex: none; accent-color: var(--accent); }
.imp-desc { padding: 0.3rem 0.5rem; font-size: 0.95rem; font-weight: 600; }
.imp-opts { display: grid; grid-template-columns: 1fr; gap: 0.4rem; margin-top: 0.45rem; padding-left: 1.85rem; }
.imp-opts select.missing { border-color: var(--warn); }

@media (min-width: 480px) { .imp-opts { grid-template-columns: auto 1fr; } }
</style>
