<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase, authRedirectUrl } from '../supabase'
import Logo from '../components/Logo.vue'

// Se activa cuando el login con Google esté configurado en Supabase
// (ver docs/CONFIGURACION-MANUAL.md, punto 5).
const GOOGLE_LOGIN = false

const router = useRouter()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

function translate(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.'
  if (/signups? not allowed/i.test(msg)) return 'Esta app es privada: tu cuenta no está dada de alta.'
  if (/email not confirmed/i.test(msg)) return 'Tienes que confirmar el email antes de entrar.'
  return msg
}

async function loginEmail() {
  busy.value = true
  error.value = null
  const { error: e } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
  busy.value = false
  if (e) {
    error.value = translate(e.message)
    return
  }
  router.push({ name: 'personal' })
}

async function loginGoogle() {
  busy.value = true
  error.value = null
  const { error: e } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl },
  })
  if (e) {
    busy.value = false
    error.value = translate(e.message)
  }
}
</script>

<template>
  <div class="space-yo auth-card card">
    <div style="margin-bottom: 0.4rem"><Logo :size="72" /></div>
    <h1>Entrar en GasTitos</h1>
    <p class="muted">Gastos y ahorro para dos. Solo pueden entrar las cuentas dadas de alta.</p>

    <form @submit.prevent="loginEmail">
      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="password">Contraseña</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" required />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" class="block" :disabled="busy">Entrar</button>
    </form>

    <template v-if="GOOGLE_LOGIN">
      <div class="row" style="margin: 1rem 0; justify-content: center"><span class="tiny">o</span></div>
      <button type="button" class="secondary block" :disabled="busy" @click="loginGoogle">Entrar con Google</button>
    </template>
  </div>
</template>
