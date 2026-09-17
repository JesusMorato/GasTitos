-- ============================================================
-- GasTitos · 0007 · Reactivar un gasto fijo no rellena los meses en pausa
--   Antes: al pausar un fijo tres meses y volver a activarlo, run_recurring
--   veía esos meses "sin fila" y creaba los tres gastos de golpe.
--   Ahora: al reactivarlo se apunta desde qué mes vuelve a contar
--   (active_since) y los meses anteriores se saltan.
-- ============================================================

alter table public.recurring_expenses
  add column if not exists active_since text check (active_since is null or active_since ~ '^\d{4}-\d{2}$');

-- Al pasar de pausado a activo, vuelve a contar desde el mes actual.
create or replace function public.recurring_reactivated()
returns trigger
language plpgsql
as $$
begin
  if new.active and not old.active then
    new.active_since := to_char(current_date, 'YYYY-MM');
  end if;
  return new;
end
$$;
drop trigger if exists recurring_reactivated_trg on public.recurring_expenses;
create trigger recurring_reactivated_trg
  before update of active on public.recurring_expenses
  for each row execute function public.recurring_reactivated();

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
      m_txt := to_char(m, 'YYYY-MM');
      -- Los meses en los que estuvo pausado no se rellenan
      if diff % r.every_n_months = 0 and (r.active_since is null or m_txt >= r.active_since) then
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

insert into public.schema_migrations (filename) values ('0007_fijos_pausados.sql')
on conflict (filename) do nothing;
