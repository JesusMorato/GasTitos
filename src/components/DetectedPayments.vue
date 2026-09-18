<script setup lang="ts">
import type { Category, DetectedPayment, PaymentKind } from '../types'
import { formatEur } from '../lib/money'
import UiIcon from './UiIcon.vue'

const props = defineProps<{
  items: DetectedPayment[]
  hasPartner: boolean
  categoryById: Record<string, Category>
  /** Tipo propuesto para la tarjeta del pago (lo elegido en Ajustes). */
  kindFor: (card: string) => PaymentKind
  /** Categoría recordada para el comercio, si ya se apuntó otra vez. */
  categoryFor: (merchant: string) => string | null
  /** Id del pago que se está guardando o descartando (botones desactivados). */
  busy?: string | null
}>()
const emit = defineEmits<{ (e: 'pick', payment: DetectedPayment, kind: PaymentKind): void; (e: 'dismiss', payment: DetectedPayment): void }>()

const labels: Record<PaymentKind, string> = { personal: 'Personal', shared: 'Repartido', pot: 'Conjunta' }

function when(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `hoy ${time}`
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} ${time}`
}

function pick(p: DetectedPayment, kind: PaymentKind) {
  if (props.busy) return
  emit('pick', p, kind)
}
function dismiss(p: DetectedPayment) {
  if (props.busy) return
  emit('dismiss', p)
}
</script>

<template>
  <div v-if="items.length" class="card detected">
    <div class="row" style="gap: 0.4rem; margin-bottom: 0.3rem">
      <UiIcon name="card" :size="18" />
      <h2>Pagos detectados</h2>
    </div>
    <p class="tiny" style="margin-bottom: 0.5rem">Pagos hechos con el móvil. Elige de qué tipo es cada uno y queda apuntado; si no lo quieres, descártalo.</p>
    <ul class="list">
      <li v-for="p in items" :key="p.id" class="detected-item">
        <div class="detected-head">
          <div class="grow" style="min-width: 0">
            <div class="ellipsis"><strong>{{ p.merchant || 'Pago' }}</strong></div>
            <div class="tiny">
              {{ when(p.paid_at) }}<template v-if="p.card"> · {{ p.card }}</template>
              <template v-if="categoryFor(p.merchant)"> · {{ categoryById[categoryFor(p.merchant)!]?.name }}</template>
            </div>
          </div>
          <div class="amount">{{ formatEur(p.amount) }}</div>
          <button type="button" class="icon" title="Descartar" aria-label="Descartar" :disabled="busy === p.id" @click="dismiss(p)"><UiIcon name="close" :size="18" /></button>
        </div>
        <div class="detected-actions">
          <button
            v-for="k in (['personal', 'shared', 'pot'] as PaymentKind[]).filter((k) => k !== 'shared' || hasPartner)"
            :key="k"
            type="button"
            class="small"
            :class="kindFor(p.card) === k ? '' : 'secondary'"
            :disabled="busy === p.id"
            @click="pick(p, k)"
          >{{ labels[k] }}</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.card.detected { border-left: 4px solid var(--accent); }
.detected-item { display: block !important; }
.detected-head { display: flex; gap: 0.6rem; align-items: center; min-width: 0; }
.detected-actions { display: flex; gap: 0.4rem; margin-top: 0.45rem; flex-wrap: wrap; }
.detected-actions button { flex: 1 1 auto; }
</style>
