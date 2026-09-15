<script setup lang="ts">
// Pantallas vacías con las ilustraciones del lienzo de diseño (formas planas,
// sin trazo, mismos verdes y ciruelas). Sustituyen a los emojis grandes.
defineProps<{ kind: 'gastos' | 'huchas' | 'pareja' }>()
</script>

<template>
  <div class="empty">
    <!-- Brote en maceta: sin gastos -->
    <svg v-if="kind === 'gastos'" width="120" height="103" viewBox="0 0 140 120" aria-hidden="true">
      <ellipse cx="70" cy="110" rx="46" ry="6" fill="var(--surface-2)" />
      <path d="M44 66h52l-6 40H50z" fill="#c8553d" />
      <rect x="40" y="58" width="60" height="12" rx="6" fill="#d97a63" />
      <path d="M70 58V34" fill="none" stroke="var(--yo)" stroke-width="4" stroke-linecap="round" />
      <path d="M70 44c-14 2-22-6-24-16 12-2 22 4 24 16z" fill="#4f9a6a" />
      <path d="M70 36c14 2 22-6 24-16-12-2-22 4-24 16z" fill="var(--yo)" />
    </svg>
    <!-- Hucha con moneda: sin huchas -->
    <svg v-else-if="kind === 'huchas'" width="120" height="103" viewBox="0 0 140 120" aria-hidden="true">
      <ellipse cx="70" cy="110" rx="46" ry="6" fill="var(--surface-2)" />
      <circle cx="70" cy="22" r="11" fill="#e9b949" />
      <circle cx="70" cy="22" r="5.5" fill="none" stroke="var(--surface)" stroke-width="3" />
      <circle cx="42" cy="45" r="9" fill="var(--yo)" />
      <rect x="26" y="46" width="88" height="56" rx="28" fill="var(--yo)" />
      <rect x="61" y="52" width="18" height="5" rx="2.5" fill="var(--surface)" opacity="0.9" />
      <circle cx="90" cy="66" r="3.2" fill="var(--surface)" />
      <circle cx="107" cy="76" r="10" fill="var(--pareja)" />
      <circle cx="103.5" cy="74.5" r="1.8" fill="var(--surface)" />
      <circle cx="110.5" cy="74.5" r="1.8" fill="var(--surface)" />
      <rect x="42" y="96" width="14" height="12" rx="5" fill="var(--yo)" />
      <rect x="84" y="96" width="14" height="12" rx="5" fill="var(--yo)" />
    </svg>
    <!-- Dos personas: invita a tu pareja -->
    <svg v-else width="120" height="103" viewBox="0 0 140 120" aria-hidden="true">
      <ellipse cx="70" cy="110" rx="46" ry="6" fill="var(--surface-2)" />
      <circle cx="50" cy="44" r="16" fill="var(--yo)" />
      <path d="M22 100c0-18 12-30 28-30s28 12 28 30z" fill="var(--yo)" />
      <circle cx="94" cy="50" r="14" fill="var(--pareja)" />
      <path d="M70 100c0-16 10-26 24-26s24 10 24 26z" fill="var(--pareja)" />
      <circle cx="121" cy="24" r="12" fill="#e9b949" />
      <path d="M121 18v12M115 24h12" fill="none" stroke="var(--surface)" stroke-width="3" stroke-linecap="round" />
    </svg>
    <slot />
  </div>
</template>
