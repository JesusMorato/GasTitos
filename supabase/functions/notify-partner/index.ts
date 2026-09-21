// ============================================================
// GasTitos · notify-partner
// Avisa a la otra persona del hogar de que se ha apuntado un gasto repartido
// o de la cuenta conjunta. La llama la propia app justo después de guardarlo.
//
// Quien llama va identificado por su sesión (Supabase comprueba el token antes
// de llegar aquí), así que solo se puede avisar de gastos del propio hogar.
//
// Con { prueba: true } no avisa a nadie más: se manda el aviso a los aparatos de
// quien llama y devuelve qué ha contestado el servicio de avisos. Sirve para ver
// desde Ajustes por qué no llegan, sin mirar los registros de Supabase.
//
// El envío es Web Push estándar, hecho a mano con WebCrypto para no depender de
// ninguna librería (ver webpush.ts, que además está probado con Vitest).
// ============================================================
import { b64urlABytes, cabeceraVapid, cifrar } from './webpush.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
// Apple es estricta con esto: acepta mejor un "mailto:" que una dirección https.
// Se pone en los secretos de Supabase como VAPID_SUBJECT.
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'https://jesusmorato.github.io/GasTitos/'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface Suscripcion {
  id: string
  endpoint: string
  p256dh: string
  auth: string
  aparato: string
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

function suscripcionesDe(userId: string) {
  return consultar<Suscripcion>(
    `push_subscriptions?user_id=eq.${userId}&select=id,endpoint,p256dh,auth,aparato`,
  )
}

// ---------- envío ----------
interface Resultado {
  aparato: string
  servicio: string
  codigo: number
  detalle: string
}

async function enviar(s: Suscripcion, mensaje: string): Promise<Resultado> {
  const servicio = new URL(s.endpoint).hostname
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
    const detalle = res.ok ? '' : (await res.text()).slice(0, 300)
    if (!res.ok) console.error('push', servicio, res.status, detalle)
    // El aparato ya no existe: se quita para no reintentar siempre.
    if (res.status === 404 || res.status === 410) await borrarSuscripcion(s.id)
    return { aparato: s.aparato, servicio, codigo: res.status, detalle }
  } catch (e) {
    const detalle = (e as Error).message
    console.error('push', servicio, detalle)
    return { aparato: s.aparato, servicio, codigo: 0, detalle }
  }
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
    const quien = usuarioDelToken(req.headers.get('Authorization'))
    if (!quien) return json({ error: 'Sin sesión' }, 401)

    const peticion = await req.json().catch(() => ({})) as { expense_id?: unknown; prueba?: unknown }
    const claves = Boolean(VAPID_PUBLIC && VAPID_PRIVATE)

    // ---------- prueba: me aviso a mí mismo y cuento qué ha pasado ----------
    if (peticion.prueba === true) {
      const mias = await suscripcionesDe(quien)
      if (!claves || mias.length === 0) {
        return json({ estado: 'prueba', claves, sujeto: VAPID_SUBJECT, aparatos: mias.length, resultados: [] })
      }
      const mensaje = JSON.stringify({
        titulo: 'Prueba de envío',
        cuerpo: 'Si ves esto, los avisos llegan bien.',
        etiqueta: 'gastitos-prueba-envio',
        hash: '#/ajustes',
      })
      const resultados = []
      for (const s of mias) resultados.push(await enviar(s, mensaje))
      return json({ estado: 'prueba', claves, sujeto: VAPID_SUBJECT, aparatos: mias.length, resultados })
    }

    // ---------- aviso de verdad a la pareja ----------
    if (!claves) return json({ estado: 'sin-configurar' })

    const expenseId = peticion.expense_id
    if (typeof expenseId !== 'string' || !expenseId) return json({ error: 'Falta expense_id' }, 400)

    // 1 · el gasto
    const gastos = await consultar<Gasto>(
      `expenses?id=eq.${expenseId}&select=id,household_id,user_id,amount,description,category_id,is_shared,funding`,
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
    const suscripciones = await suscripcionesDe(pareja.user_id)
    if (suscripciones.length === 0) return json({ estado: 'pareja-sin-avisos' })

    const mensaje = JSON.stringify({ titulo, cuerpo, etiqueta: `gasto-${gasto.id}`, hash: '#/pareja' })
    const resultados = []
    for (const s of suscripciones) resultados.push(await enviar(s, mensaje))

    return json({ estado: 'ok', enviados: resultados.filter((r) => r.codigo >= 200 && r.codigo < 300).length, resultados })
  } catch (e) {
    console.error((e as Error).message)
    return json({ error: (e as Error).message }, 500)
  }
})
