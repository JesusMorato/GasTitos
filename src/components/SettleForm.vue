<script setup lang="ts">
import { ref } from 'vue'
import type { Member } from '../types'
import { formatEur, round2, todayIso } from '../lib/money'
import Sheet from './Sheet.vue'

const props = defineProps<{
  members: readonly Member[]
  suggested: { from: string; to: string; amount: number } | null
  nameOf: (id: string) => string
}>()
const emit = defineEmits<{
  (e: 'save', v: { from_user: string; to_user: string; amount: number; settled_on: string; note: string | null }): void
  (e: 'close'): void
}>()

const from = ref(props.suggested?.from ?? props.members[0]?.user_id ?? '')
const amount = ref<number>(props.suggested?.amount ?? 0)
const date = ref(todayIso())
const note = ref('')
const error = ref<string | null>(null)

function toUser() {
  return props.members.find((m) => m.user_id !== from.value)?.user_id ?? ''
}

function submit() {
  error.value = null
  if (!(Number(amount.value) > 0)) {
    error.value = 'El importe tiene que ser mayor que 0.'
    return
  }
  if (!toUser()) {
    error.value = 'Hace falta que tu pareja esté en el hogar.'
    return
  }
  emit('save', { from_user: from.value, to_user: toUser(), amount: round2(Number(amount.value)), settled_on: date.value, note: note.value.trim() || null })
}
</script>

<template>
  <Sheet title="Saldar cuentas" @close="emit('close')">
    <form @submit.prevent="submit">
      <p class="muted">
        Apunta un pago entre vosotros (Bizum, transferencia, efectivo…). El balance se ajusta con ese importe.
        <template v-if="suggested"> Para quedar en paz: <strong>{{ nameOf(suggested.from) }} paga {{ formatEur(suggested.amount) }} a {{ nameOf(suggested.to) }}</strong>.</template>
      </p>

      <div class="field">
        <label>¿Quién paga?</label>
        <div class="chips">
          <button
            v-for="m in members"
            :key="m.user_id"
            type="button"
            class="chip"
            :class="{ active: m.user_id === from }"
            @click="from = m.user_id"
          >{{ m.display_name }}</button>
        </div>
        <p class="help">Recibe: <strong>{{ nameOf(toUser()) }}</strong></p>
      </div>

      <div class="field amount-input">
        <label for="s-amount">Importe</label>
        <input id="s-amount" v-model.number="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required />
      </div>

      <div class="grid2">
        <div class="field">
          <label for="s-date">Fecha</label>
          <input id="s-date" v-model="date" type="date" required />
        </div>
        <div class="field">
          <label for="s-note">Nota (opcional)</label>
          <input id="s-note" v-model="note" maxlength="80" placeholder="Bizum" />
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <div class="row" style="justify-content: flex-end">
        <button type="button" class="ghost" @click="emit('close')">Cancelar</button>
        <button type="submit">Registrar pago</button>
      </div>
    </form>
  </Sheet>
</template>
