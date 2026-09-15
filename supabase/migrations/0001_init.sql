-- ============================================================
-- GasTitos · migración inicial
-- Crea las tablas, las reglas de seguridad (RLS) y las funciones
-- que usa la app. Se puede ejecutar varias veces sin romper nada.
-- ============================================================

create extension if not exists pgcrypto;

-- Registro de migraciones aplicadas (lo usa el workflow de GitHub)
create table if not exists public.schema_migrations (
  filename   text primary key,
  applied_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABLAS
-- ------------------------------------------------------------

-- Un "hogar" es la pareja. Tiene un código de invitación para que
-- la segunda persona se una.
create table if not exists public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique
              default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at  timestamptz not null default now()
);

-- Quién pertenece a qué hogar. Cada usuario solo puede estar en uno.
create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id),
  unique (user_id)
);

-- Gastos. user_id = quién lo ha pagado (y, si es individual, su dueño).
-- is_shared  = gasto de la pareja (lo ven y editan los dos).
-- is_public  = gasto individual que su dueño ha decidido enseñar.
create table if not exists public.expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  spent_on     date not null default current_date,
  category     text not null,
  description  text,
  is_shared    boolean not null default false,
  is_public    boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists expenses_household_date_idx on public.expenses (household_id, spent_on desc);

-- Objetivos de ahorro. Mismas reglas de visibilidad que los gastos.
create table if not exists public.savings_goals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  deadline      date,
  is_shared     boolean not null default false,
  is_public     boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists savings_goals_household_idx on public.savings_goals (household_id);

-- Aportaciones a un objetivo.
create table if not exists public.goal_contributions (
  id             uuid primary key default gen_random_uuid(),
  goal_id        uuid not null references public.savings_goals(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  contributed_on date not null default current_date,
  note           text,
  created_at     timestamptz not null default now()
);
create index if not exists goal_contributions_goal_idx on public.goal_contributions (goal_id);

-- ------------------------------------------------------------
-- FUNCIONES DE APOYO
-- ------------------------------------------------------------

-- Hogar del usuario que está haciendo la petición (o null si no tiene).
-- security definer: se salta RLS para evitar consultas recursivas.
create or replace function public.current_household_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select household_id from public.household_members where user_id = auth.uid() limit 1
$$;

-- Máximo dos miembros por hogar.
create or replace function public.enforce_two_members()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.household_members where household_id = new.household_id) >= 2 then
    raise exception 'Este hogar ya tiene dos miembros';
  end if;
  return new;
end
$$;
drop trigger if exists household_members_max_two on public.household_members;
create trigger household_members_max_two
  before insert on public.household_members
  for each row execute function public.enforce_two_members();

-- Crear un hogar y unirse a él (lo llama la app la primera vez).
create or replace function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'No has iniciado sesión';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  insert into public.households (name) values (trim(p_name)) returning id into hid;
  insert into public.household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), trim(p_display_name));
  return hid;
end
$$;

-- Unirse a un hogar existente con su código de invitación.
create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  hid uuid;
begin
  if auth.uid() is null then
    raise exception 'No has iniciado sesión';
  end if;
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  select id into hid from public.households where invite_code = upper(trim(p_code));
  if hid is null then
    raise exception 'Código de invitación no válido';
  end if;
  insert into public.household_members (household_id, user_id, display_name)
    values (hid, auth.uid(), trim(p_display_name));
  return hid;
end
$$;

-- Solo usuarios autenticados pueden llamar a estas funciones.
revoke execute on function public.create_household(text, text) from public, anon;
revoke execute on function public.join_household(text, text) from public, anon;
grant  execute on function public.create_household(text, text) to authenticated;
grant  execute on function public.join_household(text, text) to authenticated;
grant  execute on function public.current_household_id() to authenticated, anon;

-- ------------------------------------------------------------
-- SEGURIDAD (RLS) · activada en TODAS las tablas
-- ------------------------------------------------------------

alter table public.schema_migrations  enable row level security;
alter table public.households         enable row level security;
alter table public.household_members  enable row level security;
alter table public.expenses           enable row level security;
alter table public.savings_goals      enable row level security;
alter table public.goal_contributions enable row level security;

-- schema_migrations: sin políticas = nadie desde la app (solo el workflow).

-- households: solo veo mi hogar; solo lo modifico si soy miembro.
drop policy if exists households_select on public.households;
create policy households_select on public.households
  for select to authenticated
  using (id = public.current_household_id());

drop policy if exists households_update on public.households;
create policy households_update on public.households
  for update to authenticated
  using (id = public.current_household_id())
  with check (id = public.current_household_id());

-- household_members: veo a los miembros de mi hogar. Nadie inserta directamente
-- (se hace por create_household / join_household). Puedo editar mi propio nombre.
drop policy if exists members_select on public.household_members;
create policy members_select on public.household_members
  for select to authenticated
  using (household_id = public.current_household_id());

drop policy if exists members_update_self on public.household_members;
create policy members_update_self on public.household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.current_household_id());

-- expenses
--   ver:    de mi hogar Y (compartido O mío O público)
--   crear:  en mi hogar; el pagador es un miembro; si es individual, soy yo
--   editar/borrar: de mi hogar Y (compartido O mío)
drop policy if exists expenses_select on public.expenses;
create policy expenses_select on public.expenses
  for select to authenticated
  using (
    household_id = public.current_household_id()
    and (is_shared or is_public or user_id = auth.uid())
  );

drop policy if exists expenses_insert on public.expenses;
create policy expenses_insert on public.expenses
  for insert to authenticated
  with check (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
    and exists (select 1 from public.household_members m
                where m.household_id = expenses.household_id and m.user_id = expenses.user_id)
  );

drop policy if exists expenses_update on public.expenses;
create policy expenses_update on public.expenses
  for update to authenticated
  using (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
  )
  with check (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
    and exists (select 1 from public.household_members m
                where m.household_id = expenses.household_id and m.user_id = expenses.user_id)
  );

drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses
  for delete to authenticated
  using (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
  );

-- savings_goals: mismas reglas que expenses
drop policy if exists goals_select on public.savings_goals;
create policy goals_select on public.savings_goals
  for select to authenticated
  using (
    household_id = public.current_household_id()
    and (is_shared or is_public or user_id = auth.uid())
  );

drop policy if exists goals_insert on public.savings_goals;
create policy goals_insert on public.savings_goals
  for insert to authenticated
  with check (
    household_id = public.current_household_id()
    and user_id = auth.uid()
  );

drop policy if exists goals_update on public.savings_goals;
create policy goals_update on public.savings_goals
  for update to authenticated
  using (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
  )
  with check (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
  );

drop policy if exists goals_delete on public.savings_goals;
create policy goals_delete on public.savings_goals
  for delete to authenticated
  using (
    household_id = public.current_household_id()
    and (is_shared or user_id = auth.uid())
  );

-- goal_contributions: heredan la visibilidad del objetivo.
--   ver:   si puedo ver el objetivo
--   crear: si puedo editar el objetivo, y la aportación es mía
--   editar/borrar: mía y el objetivo editable por mí
drop policy if exists contributions_select on public.goal_contributions;
create policy contributions_select on public.goal_contributions
  for select to authenticated
  using (
    exists (select 1 from public.savings_goals g
            where g.id = goal_contributions.goal_id
              and g.household_id = public.current_household_id()
              and (g.is_shared or g.is_public or g.user_id = auth.uid()))
  );

drop policy if exists contributions_insert on public.goal_contributions;
create policy contributions_insert on public.goal_contributions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.savings_goals g
                where g.id = goal_contributions.goal_id
                  and g.household_id = public.current_household_id()
                  and (g.is_shared or g.user_id = auth.uid()))
  );

drop policy if exists contributions_update on public.goal_contributions;
create policy contributions_update on public.goal_contributions
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.savings_goals g
                where g.id = goal_contributions.goal_id
                  and g.household_id = public.current_household_id()
                  and (g.is_shared or g.user_id = auth.uid()))
  )
  with check (user_id = auth.uid());

drop policy if exists contributions_delete on public.goal_contributions;
create policy contributions_delete on public.goal_contributions
  for delete to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.savings_goals g
                where g.id = goal_contributions.goal_id
                  and g.household_id = public.current_household_id()
                  and (g.is_shared or g.user_id = auth.uid()))
  );

-- Marcar esta migración como aplicada (por si se ejecuta a mano en el SQL Editor)
insert into public.schema_migrations (filename) values ('0001_init.sql')
on conflict (filename) do nothing;
