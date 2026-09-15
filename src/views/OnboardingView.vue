<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { useSession } from '../composables/useSession'

const router = useRouter()
const { state, refresh } = useSession()

const mode = ref<'create' | 'join'>('create')
const displayName = ref(state.user?.user_metadata?.full_name?.split(' ')[0] ?? '')
const householdName = ref('')
const code = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

async function submit() {
  busy.value = true
  error.value = null
  const fn = mode.value === 'create' ? 'create_household' : 'join_household'
  const args =
    mode.value === 'create'
      ? { p_name: householdName.value, p_display_name: displayName.value }
      : { p_code: code.value, p_display_name: displayName.value }
  const { error: e } = await supabase.rpc(fn, args)
  busy.value = false
  if (e) {
    error.value = e.message
    return
  }
  await refresh()
  router.push({ name: 'couple' })
}
</script>

<template>
  <div class="card" style="max-width: 480px; margin: 1rem auto">
    <h1>Casi listo</h1>
    <p class="muted">
      Tu cuenta aún no pertenece a ningún hogar. Un hogar es la pareja: dos personas, nada más.
      El primero lo crea y el segundo se une con el código que le pase el primero.
    </p>

    <div class="row" style="margin-bottom: 1rem">
      <button :class="{ secondary: mode !== 'create' }" @click="mode = 'create'">Crear hogar</button>
      <button :class="{ secondary: mode !== 'join' }" @click="mode = 'join'">Unirme con código</button>
    </div>

    <form @submit.prevent="submit">
      <div class="field">
        <label for="dn">Tu nombre (como te verá tu pareja)</label>
        <input id="dn" v-model="displayName" required maxlength="40" />
      </div>

      <div v-if="mode === 'create'" class="field">
        <label for="hn">Nombre del hogar</label>
        <input id="hn" v-model="householdName" placeholder="Casa de Ana y Luis" required maxlength="60" />
      </div>

      <div v-else class="field">
        <label for="code">Código de invitación</label>
        <input id="code" v-model="code" placeholder="AB12CD34" required style="text-transform: uppercase" />
      </div>

      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="busy" style="width: 100%">
        {{ mode === 'create' ? 'Crear hogar' : 'Unirme' }}
      </button>
    </form>
  </div>
</template>
