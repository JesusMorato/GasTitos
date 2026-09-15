<script setup lang="ts">
import { computed } from 'vue'
import { formatMonth } from '../lib/money'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const label = computed(() => formatMonth(props.modelValue))

function shift(delta: number) {
  const [y, m] = props.modelValue.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  emit('update:modelValue', `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}
</script>

<template>
  <div class="row between" style="margin: 0.2rem 0 0.8rem">
    <button type="button" class="icon" aria-label="Mes anterior" @click="shift(-1)">‹</button>
    <h2>{{ label }}</h2>
    <button type="button" class="icon" aria-label="Mes siguiente" @click="shift(1)">›</button>
  </div>
</template>
