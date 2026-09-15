<script setup lang="ts">
import { ref } from 'vue'
import type { SavingsGoal } from '../types'
import type { GoalInput } from '../composables/useData'

const props = defineProps<{ shared: boolean; initial?: SavingsGoal }>()
const emit = defineEmits<{ (e: 'save', v: GoalInput): void; (e: 'close'): void }>()

const name = ref(props.initial?.name ?? '')
const target = ref(props.initial?.target_amount ?? 0)
const deadline = ref(props.initial?.deadline ?? '')
const error = ref<string | null>(null)

function submit() {
  if (!(target.value > 0)) {
    error.value = 'La cantidad objetivo tiene que ser mayor que 0.'
    return
  }
  emit('save', {
    name: name.value.trim(),
    target_amount: Number(target.value),
    deadline: deadline.value || null,
    is_shared: props.shared,
  })
}
</script>

<template>
  <div class="modal-backdrop" @click.self="emit('close')">
    <form class="modal" @submit.prevent="submit">
      <h2>{{ initial ? 'Editar objetivo' : shared ? 'Nuevo objetivo en pareja' : 'Nuevo objetivo personal' }}</h2>

      <div class="field">
        <label for="gname">Nombre</label>
        <input id="gname" v-model="name" required maxlength="60" placeholder="Viaje a Japón" />
      </div>
      <div class="grid2">
        <div class="field">
          <label for="gtarget">Cantidad objetivo (€)</label>
          <input id="gtarget" v-model.number="target" type="number" step="0.01" min="0.01" inputmode="decimal" required />
        </div>
        <div class="field">
          <label for="gdead">Fecha límite (opcional)</label>
          <input id="gdead" v-model="deadline" type="date" />
        </div>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="row" style="justify-content: flex-end">
        <button type="button" class="secondary" @click="emit('close')">Cancelar</button>
        <button type="submit">Guardar</button>
      </div>
    </form>
  </div>
</template>
