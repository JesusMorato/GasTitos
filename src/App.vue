<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useSession } from './composables/useSession'

const { state, me, signOut } = useSession()
const router = useRouter()

async function logout() {
  await signOut()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="topbar">
    <div class="container">
      <router-link class="brand" to="/">GasTitos</router-link>
      <div v-if="state.user" class="row">
        <span class="muted">{{ me?.display_name ?? state.user.email }}</span>
        <button class="ghost small" @click="logout">Salir</button>
      </div>
    </div>
  </header>

  <main class="container grow">
    <nav v-if="state.user && state.household" class="tabs">
      <router-link :to="{ name: 'couple' }">Pareja</router-link>
      <router-link :to="{ name: 'personal' }">Yo</router-link>
    </nav>

    <p v-if="!state.ready" class="muted">Cargando…</p>
    <router-view v-else />
  </main>
</template>
