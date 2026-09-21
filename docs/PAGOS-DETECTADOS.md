# Pagos automáticos desde el iPhone (Apple Pay → GasTitos)

Cuando pagas con el móvil o el reloj, el iPhone puede avisar a GasTitos. El pago
aparece en la pestaña **Yo**, en la tarjeta "Pagos detectados", con una bolita roja en
la pestaña y en el icono de la app. Con un toque lo apuntas como Personal, Conjunta o
Repartido, o lo descartas.

No lee notificaciones ni SMS (el iPhone no lo permite): usa la automatización
**"Transacción"** de la app **Atajos**, que salta al pagar con una tarjeta de la Cartera.

**Qué pilla:** pagos con Apple Pay (móvil o Apple Watch) con las tarjetas que marques.
**Qué no pilla:** pagos con la tarjeta de plástico, compras online (aunque sean con Apple
Pay: comprobado, no dispara la automatización) y recibos o suscripciones (esos van por
gastos fijos). Para lo primero y lo segundo hay un atajo manual: ver más abajo
"Apuntar a mano lo que el atajo no pilla".

Cada persona lo monta en su iPhone con **su propio código**. Son unos 5 minutos.

---

## 1. Activar en GasTitos

1. Abre GasTitos → **Ajustes** → tarjeta **"Pagos automáticos (iPhone)"**.
2. Pulsa **"Activar: crear mi código"**.
3. Aparecen tres cosas que vas a necesitar, cada una con un botón de copiar:
   - **Código secreto** (24 letras y números). Es tuyo: no lo compartas.
   - **Dirección** a la que manda el atajo.
   - **Clave pública**.

Consejo: haz esta parte en el propio iPhone, así puedes copiar y pegar en Atajos.

## 2. Crear la automatización en Atajos

1. Abre la app **Atajos** → pestaña **Automatización** (abajo) → **+** (o "Nueva automatización").
2. Busca y elige **Transacción**.
3. Marca las tarjetas que quieras (Bankinter, Revolut…). Déjalo en **"Ejecutar inmediatamente"**
   (sin preguntar). Pulsa **Siguiente**.
4. Elige **Nuevo atajo en blanco**.
5. Añade la acción **"Obtener contenido de URL"** (búscala en el buscador de acciones) y rellénala así:
   - **URL**: pega la **dirección** que copiaste de GasTitos.
   - Despliega **"Mostrar más"**.
   - **Método**: `POST`.
   - **Cabeceras**: añade dos:
     - `apikey` → pega la **clave pública**.
     - `Content-Type` → `application/json`.
   - **Cuerpo de la solicitud**: `JSON`. Añade estos campos (Texto):

     | Clave        | Valor                                                                 |
     |--------------|-----------------------------------------------------------------------|
     | `p_token`    | pega tu **código secreto**                                            |
     | `p_amount`   | pastilla **Transacción** → propiedad **Importe**                |
     | `p_merchant` | pastilla **Transacción** → propiedad **Comerciante** (según la versión: "Vendedor", "Establecimiento" o, si no hay nada de eso, "Nombre") |
     | `p_card`     | pastilla **Transacción** → propiedad **Tarjeta o pase**         |

     Para poner una variable: toca el campo Valor y, en la barra que hay encima del
     teclado, toca la pastilla **Transacción** (es el dato del pago; si no la ves, toca
     "Seleccionar variable"). Luego toca esa pastilla ya insertada y elige la propiedad. En inglés se llaman Amount, Merchant,
     Card or Pass y Name; en español los nombres varían según la versión de iOS, así que
     escoge el que más se parezca (el "comerciante" es el nombre de la tienda).

6. Pulsa **Listo** dos veces. La automatización queda activa.

### Si no aparece "Transacción"

- Tienes que estar en la pestaña **Automatización** (la del centro, abajo) y pulsar **+**
  o "Nueva automatización". Si buscas "Apple Pay" en la pestaña Atajos solo salen
  acciones de enviar/recibir dinero: eso no es.
- Hace falta **iOS 17 o más nuevo** (Ajustes → General → Información → Versión iOS).
  Con iOS 16 no existe.
- Tiene que haber **al menos una tarjeta en la app Cartera** de ese iPhone: el disparador
  pregunta con qué tarjetas saltar, y sin tarjetas no se ofrece.
- Solo está en iPhone, no en iPad.
- Si aun así no sale, reinicia el iPhone y vuelve a mirar la lista entera (desliza hasta
  abajo: está junto a "CarPlay", "Wi‑Fi", "Bluetooth"…).

## 3. Probar

- **Sin gastar dinero:** en GasTitos → Ajustes → **"Enviar un pago de prueba"**. Debe salir
  la bolita en "Yo" y un pago de unos pocos euros llamado "Pago de prueba". Descártalo con
  la ✕. Esto comprueba la parte de GasTitos, no el atajo.
- Ojo: si en menos de dos minutos llegan dos pagos con el mismo importe y el mismo comercio,
  el segundo se ignora como repetido (el atajo a veces se dispara dos veces).
- **De verdad:** paga algo pequeño con Apple Pay con cada tarjeta. Al abrir GasTitos
  (o al cabo de un minuto si ya estaba abierta) tiene que aparecer el pago.

Si no aparece:
- Abre Atajos → Automatización → tu automatización → abajo pone si se ejecutó y si dio error.
- Revisa que el código pegado sea exactamente el de Ajustes (sin espacios).
- Revisa que las cabeceras sean `apikey` y `Content-Type` tal cual.

## 4. Apuntar un pago detectado

En la tarjeta "Pagos detectados" de **Yo**, cada pago tiene los botones Personal /
Repartido / Conjunta. El que sale resaltado es el que se propone:

1. Si ya apuntaste antes un pago **de ese mismo comercio**, se propone el tipo que le diste
   la última vez (y se recuerda también su categoría: sale "como la última vez").
2. Si es un comercio nuevo, se propone según la **tarjeta** (por defecto Revolut → Conjunta,
   el resto → Personal; se cambia en Ajustes).

- **Comercio ya conocido**: al tocar Personal o Conjunta se apunta directamente con la
  categoría recordada. Repartido también se apunta directo si la última vez fue con el
  reparto normal del hogar; si fue otro reparto, se abre el formulario.
- **Comercio nuevo**: se abre el formulario ya relleno para elegir categoría (y reparto).
- **✕**: lo descarta. Sale un aviso con **Deshacer** durante unos segundos; y en Ajustes →
  Pagos automáticos hay una lista "Descartados hace poco" con botón **Recuperar**.
- En la pestaña **Pareja** se ve "X tiene N pagos detectados sin apuntar" (solo el número).
- Los descartados se borran solos a los 90 días y los apuntados al año.

Importante: lo "recordado" sale del último pago que apuntaste de ese comercio, así que si
un día lo apuntas de otra forma, a partir de entonces propone esa.

## Apuntar a mano lo que el atajo no pilla (internet, tarjeta física)

Las compras por internet no disparan la automatización (comprobado: solo salta con los
pagos sin contacto). Para que no haya que abrir la app y rellenar el formulario, se monta
un **segundo atajo, este de accionar a mano**, que manda el pago a la misma bandeja de
"Pagos detectados". Usa la misma función `register_payment` y el mismo código secreto.

### Montarlo

1. Atajos → pestaña **Atajos** → **+** arriba a la derecha.
2. Añade **"Pedir entrada"**. Tipo: **Número**. Pregunta: `¿Cuánto?`
3. Añade otra **"Pedir entrada"**. Tipo: **Texto**. Pregunta: `¿Dónde?`
4. Añade **"Obtener contenido de URL"** y despliega "Mostrar más":
   - **URL**: la de Ajustes → Pagos automáticos.
   - **Método**: `POST`
   - **Cabeceras**: `apikey` con la clave pública, y `Content-Type` con `application/json`.
   - **Cuerpo**: `JSON`, cuatro campos de texto:

     | Clave | Valor |
     |---|---|
     | `p_token` | tu código secreto |
     | `p_amount` | la variable de la primera pregunta (el número) |
     | `p_merchant` | la variable de la segunda pregunta (el texto) |
     | `p_card` | `Internet` escrito tal cual |
5. Añade **"Mostrar notificación"** con el **Contenido de URL**, para ver si ha entrado.
6. Nómbralo "Apuntar gasto" y elige un icono.

### Cómo se acciona

Cualquiera de estas, la que te resulte más cómoda:

- **Botón de acción** (iPhone 15 Pro y posteriores): Ajustes del iPhone → Botón de acción →
  Atajo → "Apuntar gasto". Es lo más rápido: un botón físico.
- **Pantalla de inicio**: en Atajos, mantén pulsado el atajo → Compartir → Añadir a
  pantalla de inicio.
- **Centro de control** o **widget**, si lo prefieres a la vista.

### Variante todavía más rápida: desde el menú de compartir

Se puede hacer una segunda versión que se acciona **desde la página de confirmación de la
compra**, y así no hay que escribir el nombre de la tienda:

1. En los ajustes del atajo (el botón de información), activa **"Mostrar en la hoja para
   compartir"** y acepta URLs como entrada.
2. Quita la pregunta `¿Dónde?` y en `p_merchant` pon la variable **Entrada del atajo** →
   propiedad **Dominio** (o **Nombre**).

Así, al terminar una compra en Safari: compartir → "Apuntar gasto" → escribes el importe y
listo. La tienda la saca de la web.

### Qué pasa luego

El pago aparece en **Yo → Pagos detectados** igual que los automáticos, con la bolita, y se
apunta de un toque. Como llega con la tarjeta `Internet`, en Ajustes → Pagos automáticos
puedes decidir qué tipo se propone para ella (Personal, Repartido o Conjunta), y a partir
del segundo pago de la misma tienda se apunta directo con su categoría.

## Seguridad

- El código secreto es lo único que identifica al usuario. Solo sirve para **añadir** pagos
  detectados a tu lista; no permite leer nada ni tocar los gastos.
- Si crees que alguien lo tiene, pulsa **"Generar otro código"** en Ajustes y cámbialo en el atajo.
- La "clave pública" es la misma que usa la web; no es secreta.
