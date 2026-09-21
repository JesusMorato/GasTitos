-- ============================================================
-- GasTitos · 0011 · Avisos en el móvil (Web Push)
--   push_subscriptions: cada móvil/navegador donde alguien ha dado permiso para
--     recibir avisos. Una persona puede tener varios (iPhone, ordenador…).
--   Solo se usan para avisar a la pareja de un gasto repartido o de la cuenta
--   conjunta. Quien envía es la función notify-partner (con la clave de servicio),
--   por eso aquí cada uno solo ve y borra los suyos.
-- ============================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  -- Dirección que da el navegador para enviarle avisos a ese aparato
  endpoint     text not null unique,
  -- Claves públicas del aparato, necesarias para cifrar el aviso
  p256dh       text not null,
  auth         text not null,
  -- Para que en Ajustes se entienda de qué aparato es cada permiso
  aparato      text not null default '',
  created_at   timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;

drop policy if exists push_select on public.push_subscriptions;
create policy push_select on public.push_subscriptions
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid() and household_id = public.current_household_id());

drop policy if exists push_update on public.push_subscriptions;
create policy push_update on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.current_household_id());

drop policy if exists push_delete on public.push_subscriptions;
create policy push_delete on public.push_subscriptions
  for delete to authenticated
  using (user_id = auth.uid());

insert into public.schema_migrations (filename) values ('0011_avisos_push.sql')
on conflict (filename) do nothing;
