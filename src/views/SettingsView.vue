<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useSession } from '../composables/useSession'
import { useData, type RecurringInput } from '../composables/useData'
import { useConfirm } from '../composables/useConfirm'
import { usePush } from '../composables/usePush'
import type { Category, PaymentKind, RecurringExpense } from '../types'
import { supabaseAnonKey, supabaseUrl } from '../supabase'
import { formatDate, formatEur, todayIso } from '../lib/money'
import { shareOrDownload, toCsv } from '../lib/csv'
import { indexAtY, moveItem, sortOrderUpdates } from '../lib/reorder'
import CategoryIcon from '../components/CategoryIcon.vue'
import Sheet from '../components/Sheet.vue'
import EmojiPicker from '../components/EmojiPicker.vue'
import RecurringForm from '../components/RecurringForm.vue'
import RecurringList from '../components/RecurringList.vue'
import UiIcon from '../components/UiIcon.vue'

const router = useRouter()
const { state, me, partner, nameOf, signOut, renameHousehold, renameMe, setMySplit } = useSession()
const data = useData()
const { confirm } = useConfirm()
const push = usePush()

onMounted(() => {
  data.ensureLoaded(state.user?.id)
  push.comprobar()
})

const householdName = ref(state.household?.name ?? '')
const myName = ref(me.value?.display_name ?? '')
const myPct = ref<number>(Math.round(me.value?.share_pct ?? 50))
watch(me, (m) => {
  if (m) {
    myName.value = m.display_name
    myPct.value = Math.round(m.share_pct)
  }
})
const partnerPct = computed(() => 100 - Number(myPct.value || 0))

// --- límites mensuales ---
const myLimit = ref<number>(0)
const potLimit = ref<number>(0)
watch(
  () => [data.budgets.value, state.user?.id] as const,
  ([, uid]) => {
    myLimit.value = uid ? (data.myBudget(uid)?.monthly_limit ?? 0) : 0
    potLimit.value = data.potBudget.value?.monthly_limit ?? 0
  },
  { immediate: true, deep: true },
)

const msg = ref<string | null>(null)
const err = ref<string | null>(null)

async function run(fn: () => Promise<void>, okMsg: string) {
  msg.value = null
  err.value = null
  try {
    await fn()
    if (okMsg) msg.value = okMsg
  } catch (e) {
    err.value = (e as Error).message
  }
}

// --- gastos fijos ---
const recOpen = ref(false)
const recEditing = ref<RecurringExpense | undefined>()
function openRec(r?: RecurringExpense) {
  recEditing.value = r
  recOpen.value = true
}
function saveRec(input: RecurringInput) {
  const editing = recEditing.value
  recOpen.value = false
  run(() => (editing ? data.updateRecurring(editing.id, input) : data.addRecurring(state.household!.id, input)), 'Gasto fijo guardado')
}
function toggleRec(r: RecurringExpense) {
  run(() => data.updateRecurring(r.id, { active: !r.active }), r.active ? 'Gasto fijo pausado' : 'Gasto fijo activado')
}
async function deleteRec(r: RecurringExpense) {
  if (await confirm({ title: 'Borrar gasto fijo', message: `Se borra "${r.name}". Los gastos que ya se apuntaron se quedan.` })) run(() => data.deleteRecurring(r.id), 'Gasto fijo borrado')
}

// --- categorías ---
const catOpen = ref(false)
const catEditing = ref<Category | undefined>()
const catName = ref('')
const catEmoji = ref('📦')
const catColor = ref('#7a857f')
const catIcon = ref<string | null>(null)

function openCat(c?: Category) {
  catEditing.value = c
  catName.value = c?.name ?? ''
  catEmoji.value = c?.emoji ?? '📦'
  catColor.value = c?.color ?? '#7a857f'
  catIcon.value = c?.icon ?? null
  moveTo.value = ''
  catOpen.value = true
}
function saveCat() {
  const input = { name: catName.value.trim(), emoji: catEmoji.value || '📦', color: catColor.value, icon: catIcon.value }
  if (!input.name) return
  const editing = catEditing.value
  catOpen.value = false
  run(() => (editing ? data.updateCategory(editing.id, input) : data.addCategory(state.household!.id, input)), 'Categoría guardada')
}
async function deleteCat(c: Category) {
  const used = data.expenses.value.some((e) => e.category_id === c.id) || data.recurring.value.some((r) => r.category_id === c.id)
  if (used) {
    // Con gastos no se puede borrar a secas: se abre la hoja para moverlos primero.
    openCat(c)
    return
  }
  if (await confirm({ title: 'Borrar categoría', message: `¿Borrar la categoría "${c.name}"?` })) run(() => data.deleteCategory(c.id), 'Categoría borrada')
}
// Mover en bloque los gastos de la categoría que se está editando a otra
const moveTo = ref('')
const catUsage = computed(() => {
  const id = catEditing.value?.id
  if (!id) return 0
  return data.expenses.value.filter((e) => e.category_id === id).length + data.recurring.value.filter((r) => r.category_id === id).length
})
const otherCats = computed(() => data.categories.value.filter((c) => c.id !== catEditing.value?.id))
async function moveAll(del: boolean) {
  const from = catEditing.value
  const to = data.categoryById.value[moveTo.value]
  if (!from || !to) return
  const ok = await confirm({
    title: del ? 'Mover y borrar' : 'Mover gastos',
    message: del
      ? `Todos los gastos de "${from.name}" pasan a "${to.name}" y "${from.name}" se borra.`
      : `Todos los gastos de "${from.name}" (también los de tu pareja) pasan a "${to.name}".`,
    confirmLabel: del ? 'Mover y borrar' : 'Mover',
    danger: del,
  })
  if (!ok) return
  catOpen.value = false
  run(async () => {
    const n = await data.moveCategory(from.id, to.id, del)
    msg.value = `${n} ${n === 1 ? 'gasto movido' : 'gastos movidos'} a "${to.name}"${del ? ' y categoría borrada' : ''}`
  }, '')
}

// Reordenar categorías arrastrando por el asa (ratón o dedo).
// Mientras se arrastra se trabaja sobre una copia local; al soltar se guarda.
const dragFrom = ref<number | null>(null)
const dragAt = ref<number | null>(null)
const catOrder = ref<Category[]>([])
watch(() => data.categories.value, (list) => { if (dragFrom.value === null) catOrder.value = [...list] }, { immediate: true, deep: true })
const listEl = ref<HTMLUListElement | null>(null)

function startDrag(e: PointerEvent, i: number) {
  if (e.button !== 0 && e.pointerType === 'mouse') return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  dragFrom.value = i
  dragAt.value = i
}
function onDrag(e: PointerEvent) {
  if (dragFrom.value === null || !listEl.value) return
  const rows = Array.from(listEl.value.children).map((li) => {
    const r = li.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom }
  })
  const to = indexAtY(rows, e.clientY)
  if (to !== dragAt.value) {
    catOrder.value = moveItem(catOrder.value, dragAt.value ?? dragFrom.value, to)
    dragAt.value = to
  }
}
function endDrag() {
  if (dragFrom.value === null) return
  const changed = dragAt.value !== dragFrom.value
  dragFrom.value = null
  dragAt.value = null
  if (!changed) return
  const updates = sortOrderUpdates(catOrder.value)
  run(() => data.reorderCategories(updates), 'Orden actualizado')
}
function cancelDrag() {
  if (dragFrom.value === null) return
  dragFrom.value = null
  dragAt.value = null
  catOrder.value = [...data.categories.value]
}

// --- avisos en el móvil ---
async function cambiarAvisos(activar: boolean) {
  msg.value = null
  err.value = null
  if (activar) await push.activar(state.household!.id, state.user!.id)
  else await push.desactivar()
  if (push.estado.error) err.value = push.estado.error
  else msg.value = activar ? 'Avisos activados en este aparato' : 'Avisos quitados de este aparato'
}

// --- pagos automáticos (atajo del iPhone) ---
const paymentUrl = `${supabaseUrl}/rest/v1/rpc/register_payment`
const guideUrl = 'https://github.com/JesusMorato/GasTitos/blob/main/docs/PAGOS-DETECTADOS.md'
const kindLabels: Record<PaymentKind, string> = { personal: 'Personal', shared: 'Repartido', pot: 'Conjunta' }
async function copy(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text)
    msg.value = `${what} copiado`
    err.value = null
  } catch {
    err.value = 'No se ha podido copiar. Mantén pulsado el texto para seleccionarlo.'
  }
}
function activatePayments() {
  run(() => data.ensurePaymentToken(state.household!.id, state.user!.id), 'Código creado. Ahora sigue la guía para montar el atajo.')
}
async function renewToken() {
  const ok = await confirm({
    title: 'Nuevo código',
    message: 'El código de ahora dejará de valer y tendrás que cambiarlo en el atajo del iPhone.',
    confirmLabel: 'Generar otro',
    danger: true,
  })
  if (ok) run(() => data.ensurePaymentToken(state.household!.id, state.user!.id, true), 'Código nuevo generado')
}
function testPayment() {
  run(() => data.sendTestPayment(), 'Pago de prueba enviado: mira la bolita en "Yo"')
}
function restorePayment(id: string) {
  run(() => data.restorePayment(id), 'Pago recuperado: lo tienes otra vez en "Yo"')
}
function setCardKind(card: string, ev: Event) {
  run(() => data.setCardKind(card, (ev.target as HTMLSelectElement).value as PaymentKind), 'Tarjeta guardada')
}

async function logout() {
  await signOut()
  data.reset()
  router.push({ name: 'login' })
}

// --- exportar ---
function kindOfExpense(e: { is_shared: boolean; funding: string }) {
  return !e.is_shared ? 'personal' : e.funding === 'pot' ? 'conjunta' : 'repartido'
}
function exportExpenses() {
  const uid = state.user!.id
  const rows: unknown[][] = [['Fecha', 'Tipo', 'Categoría', 'Nota', 'Importe', 'Pagado por', 'Mi parte', 'Parte de mi pareja', 'Público', 'Gasto fijo']]
  for (const e of [...data.expensesWithShares.value].sort((a, b) => (a.spent_on < b.spent_on ? -1 : 1))) {
    const mine = e.shares.find((s) => s.user_id === uid)?.amount ?? null
    const theirs = e.shares.find((s) => s.user_id !== uid)?.amount ?? null
    rows.push([
      e.spent_on, kindOfExpense(e), data.categoryById.value[e.category_id]?.name ?? '', e.description ?? '', e.amount,
      e.funding === 'pot' ? 'cuenta conjunta' : nameOf(e.user_id), mine, theirs, e.is_public ? 'sí' : 'no', e.recurring_id ? 'sí' : 'no',
    ])
  }
  rows.push([])
  rows.push(['Pagos entre vosotros'])
  rows.push(['Fecha', 'De', 'A', 'Importe', 'Nota'])
  for (const s of [...data.settlements.value].sort((a, b) => (a.settled_on < b.settled_on ? -1 : 1))) {
    rows.push([s.settled_on, nameOf(s.from_user), nameOf(s.to_user), s.amount, s.note ?? ''])
  }
  void shareOrDownload(`gastitos-gastos-${todayIso()}.csv`, toCsv(rows))
}
function exportGoals() {
  const rows: unknown[][] = [['Hucha', 'Tipo', 'Objetivo', 'Fecha límite', 'Ahorrado', 'Fecha', 'Quién', 'Movimiento', 'Importe', 'Nota']]
  for (const g of data.goals.value) {
    const moves = data.contributions.value.filter((c) => c.goal_id === g.id).sort((a, b) => (a.contributed_on < b.contributed_on ? -1 : 1))
    const saved = data.savedByGoal.value[g.id] ?? 0
    if (moves.length === 0) rows.push([g.name, g.is_shared ? 'pareja' : 'personal', g.target_amount, g.deadline ?? '', saved, '', '', '', '', ''])
    for (const c of moves) {
      rows.push([g.name, g.is_shared ? 'pareja' : 'personal', g.target_amount, g.deadline ?? '', saved, c.contributed_on, nameOf(c.user_id), c.direction === 'out' ? 'sacar' : 'meter', c.amount, c.note ?? ''])
    }
  }
  void shareOrDownload(`gastitos-huchas-${todayIso()}.csv`, toCsv(rows))
}
</script>

<template>
  <div class="space-yo stack">
    <h1>Ajustes</h1>
    <p v-if="msg" class="ok">{{ msg }}</p>
    <p v-if="err" class="error">{{ err }}</p>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Gastos fijos</h2>
        <button type="button" class="small secondary" @click="openRec()">+ Nuevo</button>
      </div>
      <p class="tiny" style="margin-bottom: 0.4rem">Al entrar en un mes nuevo se apuntan solos. Los de importe variable quedan pendientes hasta que pongas la cifra.</p>
      <RecurringList
        :items="data.recurring.value"
        :category-by-id="data.categoryById.value"
        :name-of="nameOf"
        grouped
        empty-text="Aún no hay gastos fijos. Empieza por el alquiler."
        @toggle="toggleRec"
        @edit="openRec"
        @delete="deleteRec"
      />
    </div>

    <div class="card">
      <h2>Tú</h2>
      <div class="field" style="margin-top: 0.6rem">
        <label for="myname">Tu nombre (como te ve tu pareja)</label>
        <div class="row">
          <input id="myname" v-model="myName" maxlength="40" class="grow" />
          <button type="button" class="small" :disabled="!myName.trim() || myName.trim() === me?.display_name" @click="run(() => renameMe(myName), 'Nombre actualizado')">Guardar</button>
        </div>
      </div>
      <div class="tiny">Sesión: {{ state.user?.email }}</div>
    </div>

    <div class="card space-pareja">
      <h2>Hogar</h2>
      <div class="field" style="margin-top: 0.6rem">
        <label for="hname">Nombre del hogar</label>
        <div class="row">
          <input id="hname" v-model="householdName" maxlength="60" class="grow" />
          <button type="button" class="small" :disabled="!householdName.trim() || householdName.trim() === state.household?.name" @click="run(() => renameHousehold(householdName), 'Hogar renombrado')">Guardar</button>
        </div>
      </div>

      <div v-if="!partner" class="field">
        <label>Código de invitación</label>
        <div class="code-invite">{{ state.household?.invite_code }}</div>
        <p class="help">Pásaselo a tu pareja: en su primera entrada elegirá "Unirme con código".</p>
      </div>

      <div class="field">
        <label for="pct">Reparto por defecto de los gastos repartidos</label>
        <div class="row" style="margin-bottom: 0.3rem">
          <span class="grow"><strong>{{ me?.display_name ?? 'Tú' }}</strong> {{ myPct }} %</span>
          <span class="grow right"><strong>{{ partner?.display_name ?? 'Tu pareja' }}</strong> {{ partnerPct }} %</span>
        </div>
        <input id="pct" v-model.number="myPct" type="range" min="0" max="100" step="5" style="padding: 0" />
        <div class="row" style="margin-top: 0.5rem">
          <button type="button" class="small" :disabled="Math.round(me?.share_pct ?? 50) === myPct" @click="run(() => setMySplit(myPct), 'Reparto actualizado')">Guardar reparto</button>
          <button type="button" class="ghost small" @click="myPct = 50">50/50</button>
        </div>
        <p class="help">Es el reparto que se propone al apuntar un gasto repartido, y el que se usa para tu parte de la cuenta conjunta en "Mi mes".</p>
      </div>
    </div>

    <div class="card">
      <h2>Avisos en el móvil</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">
        Cuando tu pareja apunte un gasto <strong>repartido</strong> o de la <strong>cuenta conjunta</strong>, te llega un aviso.
        Los gastos personales no avisan nunca, y los gastos fijos tampoco (ya los esperas).
      </p>
      <template v-if="push.situacion.value.disponible">
        <div class="row">
          <span class="grow">{{ push.estado.activo ? 'Activados en este aparato' : 'Desactivados en este aparato' }}</span>
          <button
            type="button"
            class="small"
            :class="push.estado.activo ? 'secondary' : ''"
            :disabled="push.estado.ocupado"
            @click="cambiarAvisos(!push.estado.activo)"
          >{{ push.estado.ocupado ? 'Un momento…' : push.estado.activo ? 'Quitar' : 'Activar' }}</button>
        </div>
        <p class="help">{{ push.situacion.value.texto }}</p>
        <div v-if="push.estado.activo" class="row" style="margin-top: 0.5rem">
          <button type="button" class="ghost small" @click="push.probar()">Ver cómo se ve un aviso</button>
        </div>
      </template>
      <p v-else class="help" style="margin-top: 0">{{ push.situacion.value.texto }}</p>
    </div>

    <div class="card">
      <h2>Límites mensuales</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">Orientativos: no bloquean nada, solo avisan cuando vas rápido o te pasas. Se ven en "Mi mes" y en Pareja → Conjunta.</p>
      <div class="grid2">
        <div class="field">
          <label for="mylimit">Mi límite (personal + repartido + conjunta)</label>
          <div class="row">
            <input id="mylimit" v-model.number="myLimit" type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" class="grow" />
            <button type="button" class="small" :disabled="(myLimit || null) === (data.myBudget(state.user!.id)?.monthly_limit ?? null)" @click="run(() => data.setBudget('personal', myLimit > 0 ? myLimit : null), 'Límite guardado')">Guardar</button>
          </div>
        </div>
        <div class="field space-pareja">
          <label for="potlimit">Límite de la cuenta conjunta (común)</label>
          <div class="row">
            <input id="potlimit" v-model.number="potLimit" type="number" min="0" step="1" inputmode="decimal" placeholder="Sin límite" class="grow" />
            <button type="button" class="small" :disabled="(potLimit || null) === (data.potBudget.value?.monthly_limit ?? null)" @click="run(() => data.setBudget('pot', potLimit > 0 ? potLimit : null), 'Límite de la cuenta conjunta guardado')">Guardar</button>
          </div>
        </div>
      </div>
      <p class="help">Deja el campo a 0 o vacío y guarda para quitar un límite.</p>
    </div>

    <div class="card">
      <div class="section-title" style="margin-top: 0">
        <h2>Categorías</h2>
        <button type="button" class="small secondary" @click="openCat()">+ Nueva</button>
      </div>
      <p class="tiny" style="margin-bottom: 0.4rem">Son comunes al hogar. Elige para cada una un icono GasTitos o un emoji, y su color. Arrastra por los puntitos para cambiar el orden.</p>
      <ul ref="listEl" class="list cat-list" :class="{ dragging: dragFrom !== null }">
        <li v-for="(c, i) in catOrder" :key="c.id" :class="{ lifted: dragAt === i }">
          <span
            class="drag-handle"
            title="Arrastrar para ordenar"
            aria-label="Arrastrar para ordenar"
            @pointerdown="startDrag($event, i)"
            @pointermove="onDrag"
            @pointerup="endDrag"
            @pointercancel="cancelDrag"
          ><UiIcon name="grip" :size="18" /></span>
          <CategoryIcon :icon="c.icon" :emoji="c.emoji" :color="c.color" />
          <div class="grow ellipsis"><strong>{{ c.name }}</strong></div>
          <div class="actions">
            <button type="button" class="icon" title="Editar" aria-label="Editar" @click="openCat(c)"><UiIcon name="pencil" :size="18" /></button>
            <button type="button" class="icon" title="Borrar" aria-label="Borrar" @click="deleteCat(c)"><UiIcon name="trash" :size="18" /></button>
          </div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h2>Pagos automáticos (iPhone)</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">
        Al pagar con el móvil (Apple Pay), un atajo del iPhone avisa a GasTitos y el pago aparece en "Yo" para apuntarlo de un toque.
        <a :href="guideUrl" target="_blank" rel="noopener">Guía paso a paso</a>.
      </p>
      <template v-if="!data.paymentSettings.value">
        <button type="button" class="small" @click="activatePayments">Activar: crear mi código</button>
      </template>
      <template v-else>
        <div class="field">
          <label>Tu código secreto (solo para tu atajo)</label>
          <div class="row">
            <code class="grow secret">{{ data.paymentSettings.value.token }}</code>
            <button type="button" class="icon" title="Copiar código" aria-label="Copiar código" @click="copy(data.paymentSettings.value!.token, 'Código')"><UiIcon name="copy" :size="18" /></button>
          </div>
        </div>
        <div class="field">
          <label>Dirección a la que manda el atajo</label>
          <div class="row">
            <code class="grow secret">{{ paymentUrl }}</code>
            <button type="button" class="icon" title="Copiar dirección" aria-label="Copiar dirección" @click="copy(paymentUrl, 'Dirección')"><UiIcon name="copy" :size="18" /></button>
          </div>
        </div>
        <div class="field">
          <label>Clave pública (cabecera <em>apikey</em>)</label>
          <div class="row">
            <code class="grow secret">{{ supabaseAnonKey }}</code>
            <button type="button" class="icon" title="Copiar clave" aria-label="Copiar clave" @click="copy(supabaseAnonKey, 'Clave')"><UiIcon name="copy" :size="18" /></button>
          </div>
        </div>
        <div class="row" style="margin-bottom: 0.6rem">
          <button type="button" class="secondary small" @click="testPayment">Enviar un pago de prueba</button>
          <button type="button" class="ghost small" @click="renewToken">Generar otro código</button>
        </div>
        <div v-if="data.paymentCards.value.length" class="field">
          <label>Qué proponer según la tarjeta</label>
          <div v-for="card in data.paymentCards.value" :key="card" class="row" style="margin-bottom: 0.3rem">
            <span class="grow ellipsis">{{ card }}</span>
            <select :value="data.kindForCard(card)" @change="setCardKind(card, $event)">
              <option v-for="(label, k) in kindLabels" :key="k" :value="k">{{ label }}</option>
            </select>
          </div>
          <p class="help">Se marca ese tipo como primer botón, pero siempre puedes elegir otro.</p>
        </div>
        <div v-if="data.dismissedPayments.value.length" class="field">
          <label>Descartados hace poco</label>
          <ul class="list">
            <li v-for="p in data.dismissedPayments.value" :key="p.id">
              <div class="grow ellipsis">{{ p.merchant || 'Pago' }} <span class="tiny">· {{ formatDate(p.paid_at.slice(0, 10)) }}</span></div>
              <span class="amount">{{ formatEur(p.amount) }}</span>
              <button type="button" class="ghost small" @click="restorePayment(p.id)">Recuperar</button>
            </li>
          </ul>
          <p class="help">Los descartados se borran solos a los 90 días.</p>
        </div>
      </template>
    </div>

    <div class="card">
      <h2>Tus datos</h2>
      <p class="tiny" style="margin: 0.3rem 0 0.6rem">Copia en CSV (se abre en Excel). En el móvil se abre el menú de compartir para guardarlo o enviarlo; en el ordenador se descarga. Incluye lo que tú puedes ver: lo tuyo, lo repartido y la cuenta conjunta.</p>
      <div class="row">
        <button type="button" class="secondary small" @click="exportExpenses"><UiIcon name="arrowIn" :size="16" /> Gastos y pagos</button>
        <button type="button" class="secondary small" @click="exportGoals"><UiIcon name="arrowIn" :size="16" /> Huchas y movimientos</button>
      </div>
    </div>

    <div class="card flat">
      <button type="button" class="danger small" @click="logout">Cerrar sesión</button>
    </div>

    <RecurringForm
      v-if="recOpen && state.user"
      :members="state.members"
      :categories="data.categories.value"
      :current-user-id="state.user.id"
      :initial="recEditing"
      @save="saveRec"
      @close="recOpen = false"
    />

    <Sheet v-if="catOpen" :title="catEditing ? 'Editar categoría' : 'Nueva categoría'" @close="catOpen = false">
      <form @submit.prevent="saveCat">
        <div class="field">
          <label for="cname">Nombre</label>
          <input id="cname" v-model="catName" required maxlength="30" placeholder="Mascotas" />
        </div>
        <EmojiPicker v-model:emoji="catEmoji" v-model:color="catColor" v-model:icon="catIcon" icons @pick-icon="(i) => { if (!catName.trim()) catName = i.name }" />
        <div class="row" style="justify-content: flex-end">
          <button type="button" class="ghost" @click="catOpen = false">Cancelar</button>
          <button type="submit">Guardar</button>
        </div>
      </form>

      <template v-if="catEditing && otherCats.length">
        <hr class="sep" />
        <div class="field">
          <label for="moveto">Mover sus gastos a otra categoría</label>
          <p class="tiny" style="margin: 0 0 0.4rem">
            <template v-if="catUsage">Tiene {{ catUsage }} {{ catUsage === 1 ? 'gasto' : 'gastos' }} (contando fijos y los que ves de tu pareja).</template>
            <template v-else>No tiene gastos que tú veas; los privados de tu pareja también se moverían.</template>
          </p>
          <select id="moveto" v-model="moveTo">
            <option value="" disabled>Elige la categoría de destino…</option>
            <option v-for="c in otherCats" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="row">
          <button type="button" class="secondary small" :disabled="!moveTo" @click="moveAll(false)">Mover todos</button>
          <button type="button" class="danger small" :disabled="!moveTo" @click="moveAll(true)">Mover y borrar categoría</button>
        </div>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
.secret {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; background: var(--surface-2);
  padding: 0.45rem 0.6rem; border-radius: var(--r-md); word-break: break-all; min-width: 0;
}
.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 40px;
  margin-left: -0.35rem;
  color: var(--ink-3);
  cursor: grab;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  border-radius: var(--r-md);
}
.cat-list.dragging { cursor: grabbing; }
.cat-list.dragging .drag-handle { cursor: grabbing; }
.cat-list li { transition: background 0.15s; }
.cat-list li.lifted {
  background: var(--surface-2);
  border-radius: var(--r-md);
  box-shadow: var(--shadow);
  position: relative;
  z-index: 1;
}
.cat-list li.lifted + li { border-top-color: transparent; }
</style>
