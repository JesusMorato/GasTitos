import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// La app se publica en https://jesusmorato.github.io/GasTitos/
// por eso la ruta base es /GasTitos/ (debe coincidir con el nombre del repo).
export default defineConfig({
  plugins: [vue()],
  base: '/GasTitos/',
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
