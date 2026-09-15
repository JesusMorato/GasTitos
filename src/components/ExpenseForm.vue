<script setup lang="ts">
import { ref } from 'vue'
import { CATEGORIES, type Expense, type Member } from '../types'
import { todayIso } from '../lib/money'
import type { ExpenseInput } from '../composables/useData'

const props = defineProps<{
  shared: boolean
  members: readonly Member[]
  currentUserId: string
  initial?: Expense
}>()
const emit = defineEmits<{ (e: 'save', v: ExpenseInput): void; (e: 'close'): void }>()

const amount = ref(props.initial?.amount ?? 0)
const spentOn = ref(props.initial?.spent_on ?? todayIso())
const category = ref(props.initial?.category ?? 'Comida')
const description = ref(props.initial?.description ?? '')
const paidBy = ref(props.initial?.user_id ?? props.currentUserId)
const error = ref<string | null>(null)

function submit() {
  if (!(amount.value > 0)) {
    error.value = 'El importe tiene que ser mayor que 0.'
    return
  }
  emit('save', {
    amount: Number(amount.value),
    spent_on: spentOn.value,
    category: category.value,
    description: description.value.trim() || null,
    is_shared: props.shared,
    user_id: props.shared ? paidBy.value : props.currentUserId,
  })
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <form class="modal" @submit.prevent="submit">
      <h2>{{ initial ? 'Editar gasto' : shared ? 'Nuevo gasto compartido' : 'Nuevo gasto personal' }}</h2>

      <div class="grid2">
        <div class="field">
          <label for="amount">Importe (€)</label>
          <input id="amount" v-model.number="amount" type="number" step="0.01" min="0.01" inputmode="decimal" required />
        </div>
        <div class="field">
          <label for="date">Fecha</label>
          <input id="date" v-model="spentOn" type="date" required />
        </div>
      </div>

      <div class="field">
        <label for="cat">Categoría</label>
        <select id="cat" v-model="category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>

      <div v-if="shared" class="field">
        <label for="paid">¿Quién lo ha pagado?</label>
        <select id="paid" v-model="paidBy">
          <option v-for="m in members" :key="m.user_id" :value="m.user_id">{{ m.display_name }}</option>
        </select>
      </div>

      <div class="field">
        <label for="desc">Descripción (opcional)</label>
        <input id="desc" v-model="description" maxlength="120" placeholder="Cena del viernes" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="row" style="justify-content: flex-end">
        <button type="button" class="secondary" @click="emit('close')">Cancelar</button>
        <button type="submit">Guardar</button>
      </div>
    </form>
  </div>
</template>
