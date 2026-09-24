import { createClient } from '@supabase/supabase-js'
import { readAuthError } from './lib/authError'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en el archivo .env')
}

// Se lee antes de crear el cliente y el router, que limpian la dirección.
/** Error con el que vuelve un login con Google fallido (p. ej. cuenta no dada de alta). */
export const oauthError = readAuthError(window.location.search, window.location.hash)

export const supabase = createClient(url, key)
/** URL y clave pública: las necesita el atajo del iPhone (ver Ajustes → Pagos automáticos). */
export const supabaseUrl: string = url
export const supabaseAnonKey: string = key

// URL a la que Google/Supabase devuelven al usuario tras el login.
// En producción: https://jesusmorato.github.io/GasTitos/
export const authRedirectUrl = `${window.location.origin}${import.meta.env.BASE_URL}`
