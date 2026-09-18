# Pagos automáticos desde el iPhone (Apple Pay → GasTitos)

Cuando pagas con el móvil o el reloj, el iPhone puede avisar a GasTitos. El pago
aparece en la pestaña **Yo**, en la tarjeta "Pagos detectados", con una bolita roja en
la pestaña y en el icono de la app. Con un toque lo apuntas como Personal, Conjunta o
Repartido, o lo descartas.

No lee notificaciones ni SMS (el iPhone no lo permite): usa la automatización
**"Transacción"** de la app **Atajos**, que salta al pagar con una tarjeta de la Cartera.

**Qué pilla:** pagos con Apple Pay (móvil o Apple Watch) con las tarjetas que marques.
**Qué no pilla:** pagos con la tarjeta de plástico, compras online sin Apple Pay y recibos
domiciliados (esos van por gastos fijos).

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
     | `p_amount`   | variable **Entrada del atajo** → propiedad **Importe**                |
     | `p_merchant` | variable **Entrada del atajo** → propiedad **Comercio**               |
     | `p_card`     | variable **Entrada del atajo** → propiedad **Tarjeta** (o "Nombre de la tarjeta") |

     Para poner una variable: toca el campo Valor, elige **"Seleccionar variable"** (o el
     icono de variable en la barra del teclado) → **Entrada del atajo**. Luego toca esa
     variable ya insertada y elige la propiedad (Importe, Comercio, Tarjeta). Los nombres
     pueden variar un poco según la versión de iOS; escoge el que más se parezca.

6. Pulsa **Listo** dos veces. La automatización queda activa.

## 3. Probar

- **Sin gastar dinero:** en GasTitos → Ajustes → **"Enviar un pago de prueba"**. Debe salir
  la bolita en "Yo" y un pago de 1,00 € llamado "Pago de prueba". Descártalo con la ✕.
  Esto comprueba la parte de GasTitos, no el atajo.
- **De verdad:** paga algo pequeño con Apple Pay con cada tarjeta. Al abrir GasTitos
  (o al cabo de un minuto si ya estaba abierta) tiene que aparecer el pago.

Si no aparece:
- Abre Atajos → Automatización → tu automatización → abajo pone si se ejecutó y si dio error.
- Revisa que el código pegado sea exactamente el de Ajustes (sin espacios).
- Revisa que las cabeceras sean `apikey` y `Content-Type` tal cual.

## 4. Apuntar un pago detectado

En la tarjeta "Pagos detectados" de **Yo**, cada pago tiene los botones Personal /
Repartido / Conjunta. El que sale resaltado es el que se propone para esa tarjeta
(por defecto: Revolut → Conjunta, el resto → Personal; se cambia en Ajustes).

- **Personal** o **Conjunta**: si ya apuntaste antes un pago de ese comercio, se usa la misma
  categoría y se guarda directamente. Si es la primera vez, se abre el formulario ya
  relleno para que elijas la categoría.
- **Repartido**: siempre se abre el formulario, para elegir cómo se reparte.
- **✕**: lo descarta (no se apunta ni vuelve a salir).

## Seguridad

- El código secreto es lo único que identifica al usuario. Solo sirve para **añadir** pagos
  detectados a tu lista; no permite leer nada ni tocar los gastos.
- Si crees que alguien lo tiene, pulsa **"Generar otro código"** en Ajustes y cámbialo en el atajo.
- La "clave pública" es la misma que usa la web; no es secreta.
