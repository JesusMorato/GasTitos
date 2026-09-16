<script setup lang="ts">
import Sheet from './Sheet.vue'
import UiIcon from './UiIcon.vue'

defineProps<{ hasPartner: boolean }>()
const emit = defineEmits<{ (e: 'pick', v: 'personal' | 'shared' | 'pot'): void; (e: 'close'): void }>()
</script>

<template>
  <Sheet title="¿Qué apuntas?" @close="emit('close')">
    <div class="quick">
      <button type="button" @click="emit('pick', 'personal')">
        <span class="emoji-badge" :style="{ '--badge': 'var(--yo)' }"><UiIcon name="user" /></span>
        <span>Gasto personal<small>Solo tuyo, privado por defecto</small></span>
      </button>
      <button type="button" :disabled="!hasPartner" @click="emit('pick', 'shared')">
        <span class="emoji-badge" :style="{ '--badge': 'var(--pareja)' }"><UiIcon name="users" /></span>
        <span>Gasto repartido<small>{{ hasPartner ? 'Lo paga uno y se reparte' : 'Cuando tu pareja se una al hogar' }}</small></span>
      </button>
      <button type="button" @click="emit('pick', 'pot')">
        <span class="emoji-badge" :style="{ '--badge': 'var(--pareja)' }"><UiIcon name="card" /></span>
        <span>Gasto de la cuenta conjunta<small>Pagado con la cuenta común, no se reparte</small></span>
      </button>
    </div>
  </Sheet>
</template>
