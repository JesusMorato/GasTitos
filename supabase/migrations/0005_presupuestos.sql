-- ============================================================
-- GasTitos · 0005 · Límites de gasto mensual (presupuestos)
--   - budgets: un límite personal por usuario (privado) y uno
--     opcional para el bote (del hogar).
--   - set_budget(scope, limit): crea, actualiza o borra (limit null).
-- ============================================================

create table if not exists public.budgets (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete cascade,
  scope         text not null check (scope in ('personal', 'pot')),
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check ((scope = 'personal' and user_id is not null) or (scope = 'pot' and user_id is null))
);

-- Uno por (hogar, ámbito, usuario); el del bote no tiene usuario.
create unique index if not exists budgets_unique_idx
  on public.budgets (household_id, scope, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.budgets enable row level security;

-- Ver: el del bote lo ven los dos; el personal solo su dueño.
-- Escribir: solo a través de set_budget().
drop policy if exists budgets_select on public.budgets;
create policy budgets_select on public.budgets
  for select to authenticated
  using (
    household_id = public.current_household_id()
    and (scope = 'pot' or user_id = auth.uid())
  );

create or replace function public.set_budget(p_scope text, p_limit numeric)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  hid   uuid := public.current_household_id();
  v_uid uuid;
begin
  if auth.uid() is null or hid is null then
    raise exception 'No perteneces a ningún hogar';
  end if;
  if p_scope not in ('personal', 'pot') then
    raise exception 'Ámbito no válido';
  end if;
  v_uid := case when p_scope = 'personal' then auth.uid() else null end;

  if p_limit is null or p_limit <= 0 then
    delete from public.budgets b
     where b.household_id = hid and b.scope = p_scope and b.user_id is not distinct from v_uid;
    return;
  end if;

  update public.budgets b
     set monthly_limit = round(p_limit, 2), updated_at = now()
   where b.household_id = hid and b.scope = p_scope and b.user_id is not distinct from v_uid;
  if not found then
    insert into public.budgets (household_id, user_id, scope, monthly_limit)
    values (hid, v_uid, p_scope, round(p_limit, 2));
  end if;
end
$$;
revoke execute on function public.set_budget(text, numeric) from public, anon;
grant  execute on function public.set_budget(text, numeric) to authenticated;

insert into public.schema_migrations (filename) values ('0005_presupuestos.sql')
on conflict (filename) do nothing;
