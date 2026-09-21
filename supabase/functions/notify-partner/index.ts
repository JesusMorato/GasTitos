// ============================================================
// GasTitos · notify-partner
// Avisa a la otra persona del hogar de que se ha apuntado un gasto repartido
// o de la cuenta conjunta. La llama la propia app justo después de guardarlo.
//
// Quien llama va identificado por su sesión (Supabase comprueba el token antes
// de llegar aquí), así que solo se puede avisar de gastos del propio hogar.
//
// El envío es Web Push estándar, hecho a mano con WebCrypto para no depender de
// ninguna librería (ver webpush.ts, que además está probado con Vitest).
// ============================================================
import { b64urlABytes, cabeceraVapid, cifrar } from './webpush.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'https://jesusmorato.github.io/GasTitos/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------- consultas a la base de datos (con clave de servicio) ----------
async function consultar<T>(ruta: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`consulta ${ruta}: ${res.status} ${await res.text()}`)
  return await res.json()
}

async function borrarSuscripcion(id: string): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions?id=eq.${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
}

// ---------- quién llama ----------
// Supabase ya ha comprobado la firma del token antes de invocar la función, así
// que aquí solo hace falta leer de quién es.
function usuarioDelToken(cabecera: string | null): string | null {
  const token = (cabecera ?? '').replace(/^Bearer\s+/i, '')
  const partes = token.split('.')
  if (partes.length !== 3) return null
  try {
    const carga = JSON.parse(new TextDecoder().decode(b64urlABytes(partes[1])))
    return typeof carga.sub === 'string' ? carga.sub : null
  } catch {
    return null
  }
}

const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

interface Gasto {
  id: string
  household_id: string
  user_id: string
  amount: string
  description: string | null
  category_id: string
  is_shared: boolean
  funding: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const json = (cuerpo: unknown, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ estado: 'sin-configurar' })

    const quien = usuarioDelToken(req.headers.get('Authorization'))
    if (!quien) return json({ error: 'Sin sesión' }, 401)

    const { expense_id } = await req.json().catch(() => ({ expense_id: null }))
    if (typeof expense_id !== 'string' || !expense_id) return json({ error: 'Falta expense_id' }, 400)

    // 1 · el gasto
    const gastos = await consultar<Gasto>(
      `expenses?id=eq.${expense_id}&select=id,household_id,user_id,amount,description,category_id,is_shared,funding`,
    )
    const gasto = gastos[0]
    if (!gasto) return json({ error: 'Gasto no encontrado' }, 404)
    if (!gasto.is_shared) return json({ estado: 'no-toca' })

    // 2 · los dos miembros del hogar; quien llama tiene que ser uno de ellos
    const miembros = await consultar<{ user_id: string; display_name: string }>(
      `household_members?household_id=eq.${gasto.household_id}&select=user_id,display_name`,
    )
    if (!miembros.some((m) => m.user_id === quien)) return json({ error: 'No es tu hogar' }, 403)
    const pareja = miembros.find((m) => m.user_id !== quien)
    if (!pareja) return json({ estado: 'sin-pareja' })

    // 3 · con qué texto se avisa
    const categorias = await consultar<{ name: string }>(`categories?id=eq.${gasto.category_id}&select=name`)
    const concepto = (gasto.description ?? '').trim() || categorias[0]?.name || 'Un gasto'
    const importe = eur.format(Number(gasto.amount))
    const quienPaga = miembros.find((m) => m.user_id === gasto.user_id)?.display_name ?? 'Tu pareja'

    let titulo: string
    let cuerpo: string
    if (gasto.funding === 'pot') {
      titulo = 'Cuenta conjunta'
      cuerpo = `${quienPaga} ha apuntado ${concepto}: ${importe}.`
    } else {
      const partes = await consultar<{ amount: string }>(
        `expense_shares?expense_id=eq.${gasto.id}&user_id=eq.${pareja.user_id}&select=amount`,
      )
      const tuParte = partes[0] ? eur.format(Number(partes[0].amount)) : null
      titulo = 'Gasto repartido'
      cuerpo = tuParte
        ? `${quienPaga} ha apuntado ${concepto}: ${importe}. Te toca ${tuParte}.`
        : `${quienPaga} ha apuntado ${concepto}: ${importe}.`
    }

    // 4 · a todos los aparatos donde la pareja ha dado permiso
    const suscripciones = await consultar<{ id: string; endpoint: string; p256dh: string; auth: string }>(
      `push_subscriptions?user_id=eq.${pareja.user_id}&select=id,endpoint,p256dh,auth`,
    )
    if (suscripciones.length === 0) return json({ estado: 'pareja-sin-avisos' })

    const mensaje = JSON.stringify({ titulo, cuerpo, etiqueta: `gasto-${gasto.id}`, hash: '#/pareja' })

    let enviados = 0
    let caducados = 0
    for (const s of suscripciones) {
      try {
        const res = await fetch(s.endpoint, {
          method: 'POST',
          headers: {
            'Content-Encoding': 'aes128gcm',
            'Content-Type': 'application/octet-stream',
            TTL: '86400',
            Urgency: 'normal',
            Authorization: await cabeceraVapid({
              endpoint: s.endpoint,
              clavePublica: VAPID_PUBLIC,
              clavePrivada: VAPID_PRIVATE,
              sujeto: VAPID_SUBJECT,
            }),
          },
          body: await cifrar(s.p256dh, s.auth, mensaje),
        })
        if (res.ok) {
          enviados++
        } else if (res.status === 404 || res.status === 410) {
          // El navegador ya no quiere avisos en ese aparato: se quita.
          await borrarSuscripcion(s.id)
          caducados++
        } else {
          console.error('push', res.status, await res.text())
        }
      } catch (e) {
        console.error('push', (e as Error).message)
      }
    }

    return json({ estado: 'ok', enviados, caducados })
  } catch (e) {
    console.error((e as Error).message)
    return json({ error: (e as Error).message }, 500)
  }
})
