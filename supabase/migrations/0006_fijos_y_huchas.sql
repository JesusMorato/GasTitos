-- ============================================================
-- GasTitos · 0006 · Gastos fijos y huchas simples
--   Gastos fijos (recurrentes sin día): al abrir la app en un mes nuevo,
--   los de importe fijo se apuntan solos (día 1) y los de importe variable
--   quedan "pendientes" hasta que alguien pone la cifra.
--   Huchas: objetivo opcional y movimientos de entrada y salida.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Gastos fijos
-- ------------------------------------------------------------
create table if not exists public.recurring_expenses (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  -- personal: dueño · repartido: quién lo paga · conjunta: quién lo creó
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  category_id    uuid not null references public.categories(id) on delete restrict,
  -- null = importe variable (cada mes se pide la cifra)
  amount         numeric(12,2) check (amount is null or amount > 0),
  kind           text not null check (kind in ('personal', 'shared', 'pot')),
  split_mode     text not null default 'household'
                 check (split_mode in ('household', 'equal', 'custom', 'other_only')),
  custom_pct     numeric(5,2) check (custom_pct is null or (custom_pct >= 0 and custom_pct <= 100)),
  every_n_months int  not null default 1 check (every_n_months between 1 and 24),
  start_month    text not null check (start_month ~ '^\d{4}-\d{2}$'),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
alter table public.recurring_expenses enable row level security;

drop policy if exists recurring_select on public.recurring_expenses;
create policy recurring_select on public.recurring_expenses
  for select to authenticated
  using (household_id = public.current_household_id() and (kind <> 'personal' or user_id = auth.uid()));

drop policy if exists recurring_insert on public.recurring_expenses;
create policy recurring_insert on public.recurring_expenses
  for insert to authenticated
  with check (
    household_id = public.current_household_id()
    and (kind <> 'personal' or user_id = auth.uid())
    and exists (select 1 from public.household_members m
                where m.household_id = recurring_expenses.household_id and m.user_id = recurring_expenses.user_id)
  );

drop policy if exists recurring_update on public.recurring_expenses;
create policy recurring_update on public.recurring_expenses
  for update to authenticated
  using (household_id = public.current_household_id() and (kind <> 'personal' or user_id = auth.uid()))
  with check (
    household_id = public.current_household_id()
    and (kind <> 'personal' or user_id = auth.uid())
    and exists (select 1 from public.household_members m
                where m.household_id = recurring_expenses.household_id and m.user_id = recurring_expenses.user_id)
  );

drop policy if exists recurring_delete on public.recurring_expenses;
create policy recurring_delete on public.recurring_expenses
  for delete to authenticated
  using (household_id = public.current_household_id() and (kind <> 'personal' or user_id = auth.uid()));

-- Qué ha pasado con cada gasto fijo en cada mes
create table if not exists public.recurring_runs (
  id           uuid primary key default gen_random_uuid(),
  recurring_id uuid not null references public.recurring_expenses(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  month        text not null check (month ~ '^\d{4}-\d{2}$'),
  status       text not null check (status in ('pending', 'created', 'skipped')),
  expense_id   uuid references public.expenses(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (recurring_id, month)
);
alter table public.recurring_runs enable row level security;

-- Se ven si se ve el gasto fijo. Se escriben solo con las funciones de abajo.
drop policy if exists runs_select on public.recurring_runs;
create policy runs_select on public.recurring_runs
  for select to authenticated
  using (exists (select 1 from public.recurring_expenses r where r.id = recurring_runs.recurring_id));

-- Los gastos creados automáticamente llevan la referencia a su gasto fijo
alter table public.expenses
  add column if not exists recurring_id uuid references public.recurring_expenses(id) on delete set null;

-- Crea el gasto de un mes a partir de un gasto fijo (uso interno)
create or replace function public.create_expense_from_recurring(p_recurring uuid, p_month text, p_amount numeric, p_run uuid)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  r        public.recurring_expenses%rowtype;
  v_id     uuid;
  v_date   date := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_other  uuid;
  v_pct    numeric;
  v_payer_amt numeric(12,2);
begin
  select * into r from public.recurring_expenses where id = p_recurring;
  if r.id is null then raise exception 'Gasto fijo no encontrado'; end if;

  insert into public.expenses
    (household_id, user_id, amount, spent_on, category_id, description, is_shared, is_public, funding, split_mode, recurring_id)
  values
    (r.household_id, r.user_id, round(p_amount, 2), v_date, r.category_id, r.name,
     r.kind <> 'personal', false,
     case when r.kind = 'pot' then 'pot' else 'personal' end,
     case when r.kind = 'shared' then r.split_mode else 'household' end,
     r.id)
  returning id into v_id;

  if r.kind = 'shared' then
    select m.user_id into v_other
      from public.household_members m
     where m.household_id = r.household_id and m.user_id <> r.user_id
     limit 1;
    if v_other is null then
      -- Sin pareja aún: todo para el pagador
      insert into public.expense_shares (expense_id, user_id, amount) values (v_id, r.user_id, round(p_amount, 2));
    else
      v_pct := case r.split_mode
        when 'household'  then (select share_pct from public.household_members where household_id = r.household_id and user_id = r.user_id)
        when 'equal'      then 50
        when 'custom'     then coalesce(r.custom_pct, 50)
        when 'other_only' then 0
      end;
      v_payer_amt := round(p_amount * v_pct / 100, 2);
      insert into public.expense_shares (expense_id, user_id, amount) values (v_id, r.user_id, v_payer_amt);
      insert into public.expense_shares (expense_id, user_id, amount) values (v_id, v_other, round(p_amount, 2) - v_payer_amt);
    end if;
  end if;

  update public.recurring_runs set status = 'created', expense_id = v_id where id = p_run;
  return v_id;
end
$$;
revoke execute on function public.create_expense_from_recurring(uuid, text, numeric, uuid) from public, anon, authenticated;

-- Procesa los gastos fijos hasta el mes indicado (normalmente el actual).
-- Idempotente: cada (gasto fijo, mes) se procesa una sola vez.
create or replace function public.run_recurring(p_month text)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  hid     uuid := public.current_household_id();
  r       record;
  m       date;
  m_end   date;
  m_txt   text;
  diff    int;
  run_id  uuid;
  n       int := 0;
begin
  if uid is null or hid is null then
    raise exception 'No perteneces a ningún hogar';
  end if;
  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Mes no válido';
  end if;
  m_end := to_date(p_month || '-01', 'YYYY-MM-DD');

  for r in
    select * from public.recurring_expenses
     where household_id = hid and active
       and (kind <> 'personal' or user_id = uid)
  loop
    m := to_date(r.start_month || '-01', 'YYYY-MM-DD');
    while m <= m_end loop
      diff := (extract(year from m)::int - extract(year from to_date(r.start_month || '-01', 'YYYY-MM-DD'))::int) * 12
            + (extract(month from m)::int - extract(month from to_date(r.start_month || '-01', 'YYYY-MM-DD'))::int);
      if diff % r.every_n_months = 0 then
        m_txt := to_char(m, 'YYYY-MM');
        run_id := null;
        insert into public.recurring_runs (recurring_id, household_id, month, status)
        values (r.id, hid, m_txt, case when r.amount is null then 'pending' else 'created' end)
        on conflict (recurring_id, month) do nothing
        returning id into run_id;
        if run_id is not null then
          n := n + 1;
          if r.amount is not null then
            perform public.create_expense_from_recurring(r.id, m_txt, r.amount, run_id);
          end if;
        end if;
      end if;
      m := m + interval '1 month';
    end loop;
  end loop;
  return n;
end
$$;
revoke execute on function public.run_recurring(text) from public, anon;
grant  execute on function public.run_recurring(text) to authenticated;

-- Pone el importe a un gasto fijo pendiente y crea el gasto
create or replace function public.resolve_pending(p_run uuid, p_amount numeric)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  run public.recurring_runs%rowtype;
  r   public.recurring_expenses%rowtype;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe tiene que ser mayor que 0';
  end if;
  select * into run from public.recurring_runs where id = p_run;
  if run.id is null or run.status <> 'pending' then
    raise exception 'Este gasto fijo ya no está pendiente';
  end if;
  select * into r from public.recurring_expenses where id = run.recurring_id;
  if r.household_id <> public.current_household_id() or (r.kind = 'personal' and r.user_id <> auth.uid()) then
    raise exception 'No puedes apuntar este gasto';
  end if;
  return public.create_expense_from_recurring(r.id, run.month, p_amount, run.id);
end
$$;
revoke execute on function public.resolve_pending(uuid, numeric) from public, anon;
grant  execute on function public.resolve_pending(uuid, numeric) to authenticated;

-- Marca un pendiente como "este mes no" (p. ej. no ha llegado la factura)
create or replace function public.skip_pending(p_run uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  run public.recurring_runs%rowtype;
  r   public.recurring_expenses%rowtype;
begin
  select * into run from public.recurring_runs where id = p_run;
  if run.id is null or run.status <> 'pending' then
    raise exception 'Este gasto fijo ya no está pendiente';
  end if;
  select * into r from public.recurring_expenses where id = run.recurring_id;
  if r.household_id <> public.current_household_id() or (r.kind = 'personal' and r.user_id <> auth.uid()) then
    raise exception 'No puedes cambiar este gasto';
  end if;
  update public.recurring_runs set status = 'skipped' where id = p_run;
end
$$;
revoke execute on function public.skip_pending(uuid) from public, anon;
grant  execute on function public.skip_pending(uuid) to authenticated;

-- ------------------------------------------------------------
-- 2. Huchas simples: objetivo opcional y movimientos de salida
-- ------------------------------------------------------------
alter table public.savings_goals alter column target_amount drop not null;
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'savings_goals_target_amount_check') then
    alter table public.savings_goals drop constraint savings_goals_target_amount_check;
  end if;
end $$;
alter table public.savings_goals
  add constraint savings_goals_target_amount_check check (target_amount is null or target_amount > 0);

alter table public.goal_contributions
  add column if not exists direction text not null default 'in' check (direction in ('in', 'out'));

insert into public.schema_migrations (filename) values ('0006_fijos_y_huchas.sql')
on conflict (filename) do nothing;
