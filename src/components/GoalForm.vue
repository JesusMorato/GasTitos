<script setup lang="ts">
import { ref } from 'vue'
import type { SavingsGoal } from '../types'
import type { GoalInput } from '../composables/useData'
import Sheet from './Sheet.vue'
import EmojiPicker from './EmojiPicker.vue'

const props = defineProps<{ shared: boolean; initial?: SavingsGoal }>()
const emit = defineEmits<{ (e: 'save', v: GoalInput): void; (e: 'close'): void }>()

const name = ref(props.initial?.name ?? '')
const emoji = ref(props.initial?.emoji ?? '🐷')
const color = ref(props.initial?.color ?? '#2f6f5e')
const target = ref<number>(props.initial?.target_amount ?? 0)
const deadline = ref(props.initial?.deadline ?? '')
const error = ref<string | null>(null)

function submit() {
  if (Number(target.value) < 0) {
    error.value = 'El objetivo no puede ser negativo.'
    return
  }
  emit('save', {
    name: name.value.trim(),
    emoji: emoji.value || '🐷',
    color: color.value,
    target_amount: Number(target.value) > 0 ? Number(target.value) : null,
    deadline: Number(target.value) > 0 && deadline.value ? deadline.value : null,
    is_shared: props.shared,
  })
}
</script>

<template>
  <Sheet :title="initial ? 'Editar hucha' : shared ? 'Nueva hucha en pareja' : 'Nueva hucha'" @close="emit('close')">
    <form @submit.prevent="submit">
      <div class="field">
        <label for="gname">Nombre</label>
        <input id="gname" v-model="name" required maxlength="60" placeholder="Viaje a Japón, Colchón…" />
      </div>
      <EmojiPicker v-model:emoji="emoji" v-model:color="color" />
      <div class="grid2">
        <div class="field amount-input">
          <label for="gtarget">Objetivo (opcional)</label>
          <input id="gtarget" v-model.number="target" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Sin objetivo" />
        </div>
        <div class="field">
          <label for="gdead">Fecha límite (opcional)</label>
          <input id="gdead" v-model="deadline" type="date" :disabled="!(Number(target) > 0)" />
        </div>
      </div>
      <p class="help">Sin objetivo es un simple colchón donde vas metiendo. Con objetivo y fecha, la hucha te dice cuánto te toca poner al mes y si llegas a tiempo.</p>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="row" style="justify-content: flex-end">
        <button type="button" class="ghost" @click="emit('close')">Cancelar</button>
        <button type="submit">Guardar</button>
      </div>
    </form>
  </Sheet>
</template>
