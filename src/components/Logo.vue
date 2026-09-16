<script setup lang="ts">
// Logo GasTitos, dirección B del lienzo de diseño: la hucha con la moneda.
//  - mark: hucha verde sobre fondo transparente (barra superior, entrada)
//  - tile: baldosa verde con la hucha clara (icono de la app)
withDefaults(defineProps<{ variant?: 'mark' | 'tile'; size?: number }>(), { variant: 'mark', size: 28 })
</script>

<template>
  <svg v-if="variant === 'tile'" :width="size" :height="size" viewBox="0 0 200 200" aria-hidden="true">
    <rect width="200" height="200" rx="44" fill="#2f6f5e" />
    <circle cx="100" cy="46" r="15" fill="#e9b949" />
    <circle cx="100" cy="46" r="8" fill="none" stroke="#ffffff" stroke-width="4" />
    <circle cx="60" cy="72" r="13" fill="#dcefe8" />
    <rect x="38" y="74" width="124" height="82" rx="41" fill="#dcefe8" />
    <rect x="88" y="84" width="26" height="7" rx="3.5" fill="#2f6f5e" />
    <circle cx="128" cy="104" r="4.5" fill="#2f6f5e" />
    <circle cx="152" cy="118" r="15" fill="#b3a6e6" />
    <circle cx="147" cy="116" r="2.6" fill="#ffffff" />
    <circle cx="157" cy="116" r="2.6" fill="#ffffff" />
    <rect x="60" y="146" width="20" height="20" rx="7" fill="#dcefe8" />
    <rect x="118" y="146" width="20" height="20" rx="7" fill="#dcefe8" />
  </svg>
  <svg v-else :width="size" :height="size" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="42" r="15" fill="#e9b949" />
    <circle cx="100" cy="42" r="8" fill="none" stroke="var(--surface, #ffffff)" stroke-width="4" />
    <circle cx="60" cy="68" r="13" fill="var(--yo, #2f6f5e)" />
    <rect x="38" y="70" width="124" height="82" rx="41" fill="var(--yo, #2f6f5e)" />
    <rect x="88" y="80" width="26" height="7" rx="3.5" fill="var(--surface, #ffffff)" opacity="0.9" />
    <circle cx="128" cy="100" r="4.5" fill="var(--surface, #ffffff)" />
    <circle cx="152" cy="114" r="15" fill="var(--pareja, #5b4f8f)" />
    <circle cx="147" cy="112" r="2.6" fill="var(--surface, #ffffff)" />
    <circle cx="157" cy="112" r="2.6" fill="var(--surface, #ffffff)" />
    <rect x="60" y="142" width="20" height="20" rx="7" fill="var(--yo, #2f6f5e)" />
    <rect x="118" y="142" width="20" height="20" rx="7" fill="var(--yo, #2f6f5e)" />
  </svg>
</template>
