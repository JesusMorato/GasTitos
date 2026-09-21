// Genera el par de claves que hace falta para enviar avisos al móvil (Web Push).
// Se ejecuta UNA sola vez:  node scripts/generar-claves-vapid.mjs
// No usa ninguna librería: solo lo que trae Node.
import { webcrypto as crypto } from 'node:crypto'

const b64url = (bytes) => Buffer.from(bytes).toString('base64url')

const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
const publica = b64url(await crypto.subtle.exportKey('raw', par.publicKey))
const privada = b64url(await crypto.subtle.exportKey('pkcs8', par.privateKey))

console.log(`
=============================================================
 CLAVES PARA LOS AVISOS DEL MÓVIL
=============================================================

1) CLAVE PÚBLICA  (no es secreta: va dentro de la web)

   Pégala en el archivo .env del proyecto, en esta línea:

   VITE_VAPID_PUBLIC_KEY=${publica}

   Luego guarda el archivo y súbelo con el resto de cambios.

-------------------------------------------------------------

2) CLAVE PRIVADA  (ESTO SÍ ES SECRETO: no lo subas nunca al repo)

   Ve a Supabase → tu proyecto → Edge Functions → Secrets
   (o Project Settings → Edge Functions → Secrets) y crea DOS secretos:

   Nombre: VAPID_PUBLIC_KEY
   Valor:  ${publica}

   Nombre: VAPID_PRIVATE_KEY
   Valor:  ${privada}

=============================================================
 Cuando termines, borra la ventana del terminal (o ciérrala)
 para que la clave privada no se quede escrita por ahí.
=============================================================
`)
