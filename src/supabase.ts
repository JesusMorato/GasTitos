import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

export const supabase = createClient(url, key)

// URL a la que Google/Supabase devuelven al usuario tras el login.
// En producción: https://jesusmorato.github.io/GasTitos/
export const authRedirectUrl = `${window.location.origin}${import.meta.env.BASE_URL}`
