<script setup lang="ts">
import { EMOJI_SUGGESTIONS, PALETTE } from '../types'
import { iconsByGroup, type CategoryIconDef } from '../lib/icons'
import CategoryIcon from './CategoryIcon.vue'

// Selector de icono/emoji y color. Con `icons` muestra además el juego de
// iconos propio por grupos (solo para categorías). Elegir un icono aplica
// también su color; elegir un emoji quita el icono.
const props = defineProps<{ emoji: string; color: string; icon?: string | null; icons?: boolean; label?: string }>()
const emit = defineEmits<{
  (e: 'update:emoji', v: string): void
  (e: 'update:color', v: string): void
  (e: 'update:icon', v: string | null): void
  (e: 'pick-icon', v: CategoryIconDef): void
}>()

const groups = iconsByGroup()

function pickIcon(i: CategoryIconDef) {
  emit('update:icon', i.key)
  emit('update:color', i.color)
  emit('pick-icon', i)
}

function pickEmoji(v: string) {
  emit('update:icon', null)
  emit('update:emoji', v)
}

function onCustom(ev: Event) {
  const v = (ev.target as HTMLInputElement).value.trim()
  if (v) pickEmoji([...v].slice(0, 2).join(''))
}
</script>

<template>
  <div class="field">
    <label>{{ label ?? 'Icono y color' }}</label>
    <div class="row" style="margin-bottom: 0.5rem">
      <CategoryIcon variant="badge-lg" :icon="props.icon" :emoji="props.emoji || '❔'" :color="props.color" />
      <input
        :value="props.icon ? '' : props.emoji"
        maxlength="4"
        placeholder="Escribe o pega tu emoji"
        aria-label="Emoji personalizado"
        style="max-width: 220px"
        @input="onCustom"
      />
    </div>
    <template v-if="icons">
      <div class="icon-scroll">
        <template v-for="g in groups" :key="g.group">
          <div class="tiny icon-group">{{ g.group }}</div>
          <div class="icon-grid">
            <button
              v-for="i in g.icons"
              :key="i.key"
              type="button"
              :class="{ active: i.key === props.icon }"
              :title="i.name"
              :aria-label="`Icono ${i.name}`"
              @click="pickIcon(i)"
            >
              <CategoryIcon :icon="i.key" :color="i.color" />
              <span class="icon-name">{{ i.name }}</span>
            </button>
          </div>
        </template>
      </div>
      <div class="tiny" style="margin: 0.6rem 0 0.3rem">O un emoji</div>
    </template>
    <div class="emoji-grid" style="margin-bottom: 0.6rem">
      <button
        v-for="e in EMOJI_SUGGESTIONS"
        :key="e"
        type="button"
        :class="{ active: !props.icon && e === props.emoji }"
        :aria-label="`Emoji ${e}`"
        @click="pickEmoji(e)"
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
