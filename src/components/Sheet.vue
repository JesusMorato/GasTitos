<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { lockScroll, unlockScroll } from '../lib/scrollLock'

defineProps<{ title: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// Mientras la hoja está abierta, la página de detrás no se mueve.
onMounted(lockScroll)
onBeforeUnmount(unlockScroll)
</script>

<template>
  <div class="sheet-backdrop" @click.self="emit('close')">
    <div class="sheet" role="dialog" aria-modal="true" :aria-label="title">
      <div class="handle" />
      <header>
        <h2>{{ title }}</h2>
        <button type="button" class="icon" aria-label="Cerrar" @click="emit('close')">✕</button>
      </header>
      <slot />
    </div>
  </div>
</template>
