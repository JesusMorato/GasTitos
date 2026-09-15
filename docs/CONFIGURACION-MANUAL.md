# Configuración manual (solo la puede hacer el dueño)

Marca cada punto cuando lo termines.

## 1. Ejecutar la migración inicial en Supabase

- [ ] Supabase → proyecto GasTitos → **SQL Editor** (menú lateral).
- [ ] Pega el contenido completo de `supabase/migrations/0001_init.sql` y pulsa **Run**.
      Debe decir *Success*. Si da error, copia el mensaje tal cual y pégaselo a Claude.

## 2. Secret de la base de datos (para las migraciones automáticas)

- [ ] Supabase → botón **Connect** (arriba) → pestaña **Session pooler**
      (NO "Direct connection": esa va solo por IPv6 y GitHub no la alcanza).
- [ ] Copia la cadena. Se parece a
      `postgresql://postgres.jenklrikrwhdxzqjefgu:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`
- [ ] Sustituye `[YOUR-PASSWORD]` (con corchetes incluidos) por la contraseña de la
      base de datos que apuntaste al crear el proyecto.
- [ ] GitHub → repo GasTitos → **Settings → Secrets and variables → Actions →
      New repository secret**. Name: `SUPABASE_DB_URL`. Secret: la cadena entera.
- [ ] Opcional: GitHub → **Actions → Migraciones Supabase → Run workflow** para
      comprobar que sale en verde (dirá "0001_init.sql ya aplicada").

## 3. Activar GitHub Pages ✅ (hecho el 2026-09-15 desde Claude Code)

- [x] Espera a que en **Actions** el workflow "Deploy a GitHub Pages" esté en verde.
- [x] GitHub → repo → **Settings → Pages**. Source: *Deploy from a branch*.
      Branch: `gh-pages`, carpeta `/ (root)`. Save.
- [x] En 1-2 minutos: https://jesusmorato.github.io/GasTitos/

## 4. Crear las dos cuentas y cerrar el registro

- [ ] Supabase → **Authentication → Users → Add user → Create new user**.
      Email y contraseña de la primera persona. Marca *Auto Confirm User*.
- [ ] Repite para la segunda persona.
- [ ] Supabase → **Authentication → Sign In / Providers → Email**: desactiva
      *Allow new users to sign up*. (Así nadie más puede registrarse, ni por email
      ni por Google.)
- [ ] Supabase → **Authentication → URL Configuration**:
      - Site URL: `https://jesusmorato.github.io/GasTitos/`
      - Redirect URLs: añade `https://jesusmorato.github.io/GasTitos/**`
        y, para probar en local, `http://localhost:5173/GasTitos/**`

## 5. Login con Google (opcional, para practicar)

Idea general: Google te da un "ID de cliente" y un "secreto"; se los das a Supabase;
Supabase le dice a Google a qué dirección devolver al usuario.

**En Google Cloud Console** (https://console.cloud.google.com):

- [ ] Crea un proyecto (nombre libre, p. ej. "GasTitos").
- [ ] Menú **APIs y servicios → Pantalla de consentimiento OAuth**. Tipo *Externo*.
      Nombre de la app "GasTitos", tu email de soporte, y guarda.
- [ ] En **Público** (o "Test users"): añade los dos emails de la pareja. Mientras
      la app esté en modo "Prueba", solo ellos podrán entrar con Google, que es
      justo lo que queremos.
- [ ] **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de
      OAuth**. Tipo: *Aplicación web*.
      - Orígenes de JavaScript autorizados: `https://jenklrikrwhdxzqjefgu.supabase.co`
      - URI de redirección autorizados: `https://jenklrikrwhdxzqjefgu.supabase.co/auth/v1/callback`
- [ ] Copia el **ID de cliente** y el **Secreto de cliente**.

**En Supabase:**

- [ ] **Authentication → Sign In / Providers → Google**: actívalo y pega ID y secreto.
      Guarda.
- [ ] Comprueba que en **URL Configuration** están las redirect URLs del punto 4.

**Importante:** el email de Google tiene que ser exactamente el mismo con el que
creaste la cuenta en el punto 4. Supabase enlaza ambas formas de entrar por el email
verificado. Si es distinto, con el registro cerrado Google dirá "Signups not
allowed" y la app mostrará *"Esta app es privada"*.

## 6. Primera prueba

- [ ] Abre https://jesusmorato.github.io/GasTitos/ y entra con la primera cuenta.
- [ ] Crea el hogar. Copia el código de invitación.
- [ ] Entra con la segunda cuenta (otro navegador o incógnito) y únete con el código.
- [ ] Apunta un gasto compartido y uno personal; comprueba desde la otra cuenta que
      el personal no se ve hasta que pulsas el candado.
- [ ] Cuéntale a Claude el resultado, funcione o no.
