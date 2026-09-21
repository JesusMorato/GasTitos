# Avisos en el móvil cuando la pareja apunta un gasto

Cuando uno apunta un gasto **repartido** o de la **cuenta conjunta**, al otro le llega un
aviso al móvil, aunque tenga GasTitos cerrada:

> **Gasto repartido**
> Marta ha apuntado Compra semanal: 86,40 €. Te toca 43,20 €.

Al tocarlo se abre la app en la pestaña Pareja.

**Qué NO avisa**, a propósito:
- Los gastos **personales** (son privados, no le tocan a nadie más).
- Los **gastos fijos** que se apuntan solos cada mes (el alquiler, la luz: ya los esperas).
- Los pagos detectados de Apple Pay mientras no los apuntes: esos solo ponen la bolita.

---

## Cómo funciona por dentro

1. La app guarda el gasto con `save_expense`, como siempre.
2. Si el gasto es nuevo y es repartido o de la conjunta, llama a la función
   `notify-partner` de Supabase (`supabase/functions/notify-partner/`).
3. La función mira de quién es el gasto, busca a la otra persona del hogar y manda el
   aviso a todos los aparatos donde esa persona lo haya permitido
   (tabla `push_subscriptions`).
4. El aviso llega al `service worker` de la app (`public/sw.js`), que es quien lo enseña.

Si el aviso falla (sin red, función sin publicar), **el gasto se guarda igual**: el aviso
va por detrás y nunca bloquea nada.

El cifrado del aviso está hecho a mano con WebCrypto, sin librerías
(`supabase/functions/notify-partner/webpush.ts`), y tiene su prueba de ida y vuelta en
`webpush.spec.ts`: se cifra como el servidor y se descifra como el navegador.

---

## Puesta en marcha (una sola vez, la hace el dueño)

### 1. Generar las claves

En el terminal, dentro de la carpeta del proyecto:

```
node scripts/generar-claves-vapid.mjs
```

Hace dos cosas solo:

- Escribe la clave **pública** en `.env` (no es secreta: va dentro de la web).
- Guarda la clave **privada** en `claves-vapid.local`, que está en `.gitignore`.

La privada **no se imprime en pantalla** a propósito, para que no quede en el historial
del terminal ni en ninguna conversación.

### 2. Las dos claves, en Supabase

Abre el archivo `claves-vapid.local` que acaba de crearse. Lleva los dos valores.

Supabase → tu proyecto → **Edge Functions → Secrets** (o Project Settings → Edge
Functions → Secrets) → **Add new secret**, dos veces:

| Nombre | Valor |
|---|---|
| `VAPID_PUBLIC_KEY` | la clave pública |
| `VAPID_PRIVATE_KEY` | la clave privada |
| `VAPID_SUBJECT` | `mailto:` y tu correo, por ejemplo `mailto:yo@ejemplo.com` |

El tercero es el remitente. Apple es tiquismiquis con esto: si no es un `mailto:`
válido, rechaza los envíos con un error 403 y los avisos no llegan nunca.

Cuando termines, **borra `claves-vapid.local`**.

### 3. Permiso para que GitHub publique la función

- Supabase → tu foto (arriba a la derecha) → **Account settings → Access Tokens** →
  **Generate new token**. Ponle de nombre "GitHub" y copia el token (solo se ve una vez).
- GitHub → repo GasTitos → **Settings → Secrets and variables → Actions → New repository
  secret**. Name: `SUPABASE_ACCESS_TOKEN`. Secret: el token.

### 4. Subir los cambios

Al hacer push a `main` se lanzan solos tres automatismos:
- **Migraciones Supabase** crea la tabla `push_subscriptions`.
- **Funciones Supabase** publica `notify-partner`.
- **Deploy a GitHub Pages** publica la web con la clave pública dentro.

Comprueba en la pestaña **Actions** que los tres salen en verde.

### 5. En cada iPhone (lo hace cada uno en el suyo)

1. La app tiene que estar **añadida a la pantalla de inicio**: en Safari, botón de
   compartir → "Añadir a pantalla de inicio". En el iPhone los avisos web solo funcionan
   así, no desde Safari normal.
2. Abre GasTitos **desde ese icono**.
3. Ajustes → **Avisos en el móvil** → **Activar**. El iPhone pregunta si permites las
   notificaciones: di que sí.
4. Pulsa **"Ver cómo se ve un aviso"** para comprobar que aparecen.

### 6. La prueba de verdad

Que uno apunte un gasto repartido de 1 € y que el otro compruebe que le llega el aviso
con la app cerrada. Luego bórralo.

---

## Si algo no va

| Qué pasa | Qué mirar |
|---|---|
| En Ajustes dice "aún no están configurados" | Falta `VITE_VAPID_PUBLIC_KEY` en `.env`, o la web publicada es anterior a ese cambio. |
| En Ajustes dice que hay que añadirla a la pantalla de inicio | Estás en Safari normal. Abre la app desde su icono. |
| Activas los avisos pero no llega ninguno | Ajustes → Avisos → **"Probar el envío de verdad"**. Te manda un aviso a ti mismo y enseña el motivo exacto si falla. Un **403** casi siempre es el secreto `VAPID_SUBJECT` mal puesto (tiene que ser un `mailto:`). |
| Llegaban y han dejado de llegar | Si borras la app del iPhone o limpias los datos del navegador, el permiso se pierde. Vuelve a darle a Activar. |
| Has cambiado las claves VAPID | Los permisos que ya había estaban atados a las claves viejas. La app lo detecta y los renueva al darle a **Activar** otra vez, en cada móvil. |
| Quieres dejar de recibirlos | Ajustes → Avisos → **Quitar**. Solo afecta a ese aparato. |

## Seguridad

- Cada persona solo ve y borra sus propios permisos (regla RLS en `push_subscriptions`).
- La función solo deja avisar de gastos del hogar de quien llama, y solo si son
  repartidos o de la cuenta conjunta. Nunca se manda nada de un gasto personal.
- El aviso va cifrado de punta a punta con las claves del propio aparato: el servicio de
  Apple o Google que lo transporta no puede leerlo.
- La clave privada vive solo en los secretos de Supabase. Nunca entra en el repo.
