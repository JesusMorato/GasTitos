# Pagos automáticos desde Android (notificaciones → GasTitos)

Es lo mismo que en el iPhone (`PAGOS-DETECTADOS.md`): al pagar, el móvil avisa a GasTitos y
el pago aparece en **Yo → "Pagos detectados"** con la bolita roja, para apuntarlo de un
toque como Personal, Conjunta o Repartido, o descartarlo.

La diferencia es el camino. En Android no existe el disparador "Transacción", pero a cambio
una app de automatizaciones **sí puede leer las notificaciones** de otras apps. Así que se
usa la notificación que manda el banco (o Google Wallet) al pagar: "Compra de 23,45 € en
MERCADONA". Vale para **cualquier banco que avise de las compras** y pilla también las
compras **por internet** y con la **tarjeta de plástico**, cosa que en el iPhone solo se
consigue con iOS 26.

Hace falta una app de automatizaciones. Dos opciones:

- **MacroDroid** (gratis hasta 5 macros, que sobran). Es la que se explica paso a paso.
- **Tasker** (de pago, unos 3,5 €). Más potente y más árida. Al final hay una versión corta.

Cada persona lo monta en su móvil con **su propio código**. Son unos 10 minutos.

---

## 1. Activar en GasTitos

1. Abre GasTitos → **Ajustes** → tarjeta **"Pagos automáticos (móvil)"**.
2. Pulsa **"Activar: crear mi código"**.
3. Aparecen tres cosas, cada una con botón de copiar:
   - **Código secreto** (24 letras y números). Es tuyo: no lo compartas.
   - **Dirección** a la que hay que mandar el pago.
   - **Clave pública**.

Consejo: hazlo en el propio móvil para copiar y pegar en MacroDroid.

## 2. Antes de montar la macro: mira una notificación real

1. En la app del banco, activa los **avisos de compras** (suelen estar en Ajustes →
   Notificaciones). Si pagas con Google Wallet, Wallet también manda su propio aviso.
2. Paga algo pequeño y **copia el texto de la notificación** (mantén pulsada la
   notificación o hazle una captura). Lo necesitas para dos cosas:
   - saber qué **palabra** lleva siempre (`Compra`, `Pago`, `pagado`…) y filtrar por ella,
     para que no salten los avisos de ingresos, recibos o publicidad;
   - comprobar que la expresión que saca el **importe** y la **tienda** encaja con su formato.

Ejemplos reales de formato (cada banco escribe distinto):

| App | Texto típico |
|---|---|
| Bankinter | `Compra de 23,45 EUR en MERCADONA con tarjeta ...1234` |
| BBVA | `Has pagado 23,45 € en MERCADONA` |
| Revolut | `Pagaste 23,45 € en Mercadona` |
| Google Wallet | `Has pagado 23,45 € en Mercadona con ·· 1234` |

## 3. Montar la macro en MacroDroid

Instala **MacroDroid** (Play Store). La primera vez pide permisos; el importante es el
**acceso a notificaciones** (te lleva a Ajustes de Android → Acceso a notificaciones →
activar MacroDroid). Sin eso no ve nada.

Los nombres de los menús pueden variar un poco según la versión; busca el que más se parezca.

### Disparador (cuándo salta)

1. **Añadir macro** → **Disparadores** → **+** → **Notificación** → **Notificación recibida**.
2. Elige **"Seleccionar aplicaciones"** y marca la app del banco (o Google Wallet).
3. En las opciones, activa **"Contenido de texto contiene"** (o "El texto contiene") y
   escribe la palabra del paso 2, por ejemplo `Compra`. Deja marcado que incluya el texto
   de la notificación.
4. Acepta. MacroDroid deja el texto de la notificación en las variables mágicas
   `{notification}` (contenido) y `{not_title}` (título).

### Acciones (qué hace)

**Acción 1 · sacar el importe.**

1. **Acciones** → **+** → **Variables** → **Establecer variable** → **Nueva** → nombre
   `importe`, tipo **Texto**.
2. Como valor, elige **Manipulación de texto** → **Expresión regular** (puede llamarse
   "Extraer con expresión regular" o "Regex") sobre `{notification}`, patrón:

   ```
   (\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s?(?:€|EUR)
   ```

   y **grupo 1**. Eso saca `23,45` (o `1.234,56`). No hace falta cambiar la coma por
   punto: GasTitos entiende los dos.

   *Si tu versión de MacroDroid no tiene expresión regular*, hay un camino sin ella: usa
   **Subcadena** dos veces, "desde después de" la palabra que va antes del importe (`de `
   o `pagado `) y "hasta antes de" ` €` (o ` EUR`).

**Acción 2 · sacar la tienda.**

Igual que la anterior, variable `tienda`, expresión regular sobre `{notification}`:

```
\ben\s+(.+?)(?:\s+(?:con|el|a las)\b|[.,]|$)
```

grupo **1**. Coge lo que va después de " en " y antes de " con", " el" o un punto. Si la
notificación no trae la tienda, pon de valor `{not_title}` o el texto `Compra`.

**Acción 3 · mandarlo a GasTitos.**

1. **Acciones** → **+** → **Conectividad** → **Petición HTTP (GET/POST)**.
2. **Método**: `POST`.
3. **URL**: pega la **dirección** de Ajustes de GasTitos.
4. **Cabeceras** (añadir dos):
   - `apikey` → pega la **clave pública**.
   - `Content-Type` → `application/json`.
5. **Cuerpo** (o "Contenido"): tipo **texto / JSON**, y escribe tal cual, cambiando solo tu
   código y el nombre del banco:

   ```json
   {"p_token":"AQUI_TU_CODIGO","p_amount":"{lv=importe}","p_merchant":"{lv=tienda}","p_card":"Bankinter aviso"}
   ```

   `{lv=importe}` y `{lv=tienda}` son las variables de las acciones 1 y 2 (en MacroDroid
   se insertan con el botón "..." → variables locales). Si las creaste como variables
   globales, es `{v=importe}`.

6. Opcional pero útil mientras lo pruebas: en la misma acción marca **"Guardar respuesta
   en variable"** y añade después una acción **Notificación → Mostrar notificación** con
   esa variable: verás `ok` o el error que haya dado.

**Nombre de la macro**: por ejemplo `GasTitos Bankinter`. Guarda. Comprueba que queda
**activada** (interruptor de la macro) y que MacroDroid no esté restringido por el ahorro
de batería (Ajustes de Android → Batería → MacroDroid → "Sin restricciones"), si no, a
veces no salta con la pantalla apagada.

### Una macro por cada app que avise

Si usas dos bancos, o banco + Google Wallet, **clona la macro** (mantener pulsada → Clonar)
y cambia la app del disparador, la palabra del filtro y el `p_card`. Pon un `p_card`
**distinto para cada app**: `Bankinter aviso`, `Revolut aviso`, `Wallet`. Es lo que usa
GasTitos para quitar repetidos (ver más abajo) y para proponer el tipo según la tarjeta.

## 4. Probar

- **Sin gastar**: GasTitos → Ajustes → **"Enviar un pago de prueba"**. Debe salir la bolita
  en "Yo" y un "Pago de prueba". Esto prueba GasTitos, no la macro.
- **La macro sin pagar**: en MacroDroid, abre la macro y usa **"Probar acciones"**. Como
  no hay notificación real, `{notification}` va vacío y GasTitos responderá "Importe no
  válido": eso ya confirma que la petición llega y que el código y las cabeceras están bien.
- **De verdad**: paga algo pequeño. Al abrir GasTitos (o al cabo de un minuto si estaba
  abierta) tiene que aparecer el pago con su tienda.

Si no aparece:

- MacroDroid → **Registro del sistema** (menú lateral): dice si la macro saltó y qué
  respondió la petición.
- Si no saltó: revisa el permiso de acceso a notificaciones, que la app elegida sea la
  correcta y que la palabra del filtro esté de verdad en la notificación (mayúsculas
  incluidas: el filtro distingue `Compra` de `compra` salvo que marques "ignorar
  mayúsculas").
- Si saltó pero GasTitos responde error: `Importe no válido` → la expresión del importe no
  encaja con tu notificación (mírala y ajústala); `Código no válido` → el `p_token` no es
  exactamente el de Ajustes; error 401 → la cabecera `apikey` está mal.
- Si mandas dos pagos iguales en menos de dos minutos, el segundo se ignora como repetido.

## 5. Apuntar a mano lo que no manda notificación

Para lo que ningún aviso pilla (un pago en efectivo, un banco que no avisa), una segunda
macro de accionar a mano, con un **widget** o un **botón en los ajustes rápidos**:

1. **Disparador**: **Widget de MacroDroid** (o **Botón de ajustes rápidos**). Ponle de
   etiqueta "Apuntar gasto".
2. **Acciones**: **Diálogo → Pedir entrada de texto** → guarda en variable `importe`
   (mensaje `¿Cuánto?`, teclado numérico); otro igual en `tienda` (`¿Dónde?`).
3. La misma **Petición HTTP** del paso 3, con `"p_card":"A mano"`.

Aparece en Yo → Pagos detectados como los demás, y desde el segundo pago de la misma
tienda se apunta directo con su categoría.

## 6. Sin repetidos entre el banco y Google Wallet

Si pagas con el móvil en una tienda pueden saltar dos avisos (el del banco y el de
Wallet) y, con dos macros, llegar dos veces. GasTitos **solo guarda uno**: si llega un
pago con el **mismo importe** que otro que entró **por otro camino** (otro `p_card`) en
los **últimos 10 minutos**, se toma por el mismo aunque la tienda venga escrita distinto.
Por eso cada macro lleva su propio `p_card`. La regla completa está en
`PAGOS-DETECTADOS.md` ("Sin repetidos").

El único caso raro: dos compras **distintas** del **mismo importe exacto** por dos caminos
en menos de 10 minutos. La segunda se tomaría por repetida; apúntala con el ➕.

## 7. Qué se propone al apuntar

Igual que en el iPhone: la primera vez que llega una tienda, se propone el tipo según el
`p_card` (en Ajustes → Pagos automáticos → "Qué proponer según la tarjeta"; por defecto
todo Personal salvo lo que lleve "Revolut", que va a Conjunta). A partir de entonces, se
propone **lo que hiciste la última vez con esa tienda**, con su categoría, y se apunta de
un toque.

---

## Versión Tasker (para quien ya lo use)

1. **Perfil** → **Evento** → **UI** → **Notification** → app del banco; en *Text* pon
   `*Compra*` (o la palabra de tu banco). Tasker deja el texto en `%evtprm3` (contenido) y
   `%evtprm2` (título).
2. **Tarea** nueva:
   - **Variables → Variable Search Replace**: Variable `%evtprm3`, Search
     `\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}`, marca *Store Matches In* → `%imp`.
     El importe queda en `%imp1` (`23,45`; la coma vale).
   - Otra **Variable Search Replace** sobre `%evtprm3` con `\ben\s+(.+?)(?:\s+(?:con|el|a las)\b|[.,]|$)`,
     *Store Matches In* `%tnd`. Si la tienda no sale limpia, usa `%evtprm2`.
   - **Net → HTTP Request**: Method `POST`, URL la dirección de Ajustes, Headers
     (una por línea) `apikey:TU_CLAVE_PUBLICA` y `Content-Type:application/json`, Body:

     ```json
     {"p_token":"TU_CODIGO","p_amount":"%imp1","p_merchant":"%tnd1","p_card":"Bankinter aviso"}
     ```

   - Opcional: **Alert → Flash** con `%http_data` para ver la respuesta.
3. Activa el perfil y dale a Tasker acceso a notificaciones si lo pide.

## Seguridad

- El código secreto solo sirve para **añadir** pagos detectados a tu lista; no permite leer
  nada ni tocar los gastos. Si crees que alguien lo tiene, **"Generar otro código"** en
  Ajustes y cámbialo en la macro.
- La "clave pública" es la misma que usa la web; no es secreta.
- MacroDroid lee **todas** las notificaciones de las apps que marques en el disparador
  (solo esas). Lo que se manda a GasTitos es únicamente importe, tienda y el nombre que
  pongas en `p_card`.
