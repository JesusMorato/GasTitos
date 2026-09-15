<script setup lang="ts">
import { computed } from 'vue'
import { iconByKey } from '../lib/icons'

// Dibuja el icono de una categoría: el del juego propio si tiene clave, y si
// no, su emoji. `badge` es el cuadrado de color de las listas; `inline` es solo
// el glifo, para ponerlo delante de un texto.
const props = withDefaults(
  defineProps<{
    icon?: string | null
    emoji?: string
    color?: string
    variant?: 'badge' | 'badge-lg' | 'inline'
  }>(),
  { icon: null, emoji: '📦', color: '#7a857f', variant: 'badge' },
)

const def = computed(() => iconByKey(props.icon))
</script>

<template>
  <template v-if="variant === 'inline'">
    <svg
      v-if="def"
      class="cat-glyph"
      :style="{ color }"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="def.svg"
    />
    <span v-else class="cat-glyph-emoji" aria-hidden="true">{{ emoji }}</span>
  </template>
  <span v-else class="emoji-badge" :class="{ lg: variant === 'badge-lg' }" :style="{ '--badge': color }">
    <svg
      v-if="def"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      v-html="def.svg"
    />
    <template v-else>{{ emoji }}</template>
  </span>
</template>
