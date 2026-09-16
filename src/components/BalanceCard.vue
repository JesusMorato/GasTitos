<script setup lang="ts">
import type { Member } from '../types'
import type { Balance } from '../lib/money'
import { formatEur } from '../lib/money'

defineProps<{
  balance: Balance
  members: readonly Member[]
  currentUserId: string
  nameOf: (id: string) => string
}>()
const emit = defineEmits<{ (e: 'settle'): void }>()

function initial(name: string) {
  return name.trim().charAt(0).toUpperCase()
}
</script>

<template>
  <div class="card accent">
    <div class="tiny" style="text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700">Balance</div>
    <template v-if="balance.settlement">
      <div class="hero-number" style="margin: 0.2rem 0">{{ formatEur(balance.settlement.amount) }}</div>
      <div class="balance-line">
        <span class="avatar" :style="{ background: 'rgba(255,255,255,.25)', color: 'inherit' }">{{ initial(nameOf(balance.settlement.from)) }}</span>
        <strong v-if="balance.settlement.from === currentUserId">Le debes a {{ nameOf(balance.settlement.to) }}</strong>
        <strong v-else-if="balance.settlement.to === currentUserId">{{ nameOf(balance.settlement.from) }} te debe</strong>
        <strong v-else>{{ nameOf(balance.settlement.from) }} le debe a {{ nameOf(balance.settlement.to) }}</strong>
      </div>
    </template>
    <template v-else>
      <div class="hero-number" style="margin: 0.2rem 0">En paz</div>
      <div class="muted">Nadie debe nada a nadie.</div>
    </template>
    <div class="row" style="margin-top: 0.9rem; justify-content: space-between">
      <div class="tiny">
        <span v-for="m in members" :key="m.user_id" style="margin-right: 0.8rem">
          {{ m.display_name }}
          <strong class="tnum">{{ balance.net[m.user_id] > 0 ? '+' : '' }}{{ formatEur(balance.net[m.user_id] ?? 0) }}</strong>
        </span>
      </div>
      <button v-if="balance.settlement" type="button" class="small" style="background: var(--surface); color: var(--accent-ink); border-color: transparent" @click="emit('settle')">
        Saldar
      </button>
    </div>
  </div>
</template>
