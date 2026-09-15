<script setup lang="ts">
import { EMOJI_SUGGESTIONS, PALETTE } from '../types'

const props = defineProps<{ emoji: string; color: string; label?: string }>()
const emit = defineEmits<{ (e: 'update:emoji', v: string): void; (e: 'update:color', v: string): void }>()

function onCustom(ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  if (v) emit('update:emoji', [...v].slice(0, 2).join(''))
}
</script>

<template>
  <div class="field">
    <label>{{ label ?? 'Icono y color' }}</label>
    <div class="row" style="margin-bottom: 0.5rem">
      <span class="emoji-badge lg" :style="{ '--badge': props.color }">{{ props.emoji || '❔' }}</span>
      <input
        :value="props.emoji"
        maxlength="4"
        placeholder="Escribe o pega tu emoji"
        aria-label="Emoji personalizado"
        style="max-width: 220px"
        @input="onCustom"
      />
    </div>
    <div class="emoji-grid" style="margin-bottom: 0.6rem">
      <button
        v-for="e in EMOJI_SUGGESTIONS"
        :key="e"
        type="button"
        :class="{ active: e === props.emoji }"
        :aria-label="`Emoji ${e}`"
        @click="emit('update:emoji', e)"
      >{{ e }}</button>
    </div>
    <div class="swatches">
      <button
        v-for="c in PALETTE"
        :key="c"
        type="button"
        :style="{ '--sw': c }"
        :class="{ active: c === props.color }"
        :aria-label="`Color ${c}`"
        @click="emit('update:color', c)"
      />
    </div>
  </div>
</template>
