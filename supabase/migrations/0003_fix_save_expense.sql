-- ============================================================
-- GasTitos · 0003 · Corrige save_expense()
-- Error: column reference "s" is ambiguous. La variable plpgsql "s"
-- chocaba con el alias "s" del insert final. Se renombran ambos.
-- ============================================================

create or replace function public.save_expense(p jsonb)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  uid          uuid := auth.uid();
  hid          uuid := public.current_household_id();
  v_id         uuid := nullif(p->>'id', '')::uuid;
  v_amount     numeric(12,2) := (p->>'amount')::numeric;
  v_spent_on   date := coalesce((p->>'spent_on')::date, current_date);
  v_category   uuid := (p->>'category_id')::uuid;
  v_desc       text := nullif(trim(coalesce(p->>'description', '')), '');
  v_is_shared  boolean := coalesce((p->>'is_shared')::boolean, false);
  v_is_public  boolean := coalesce((p->>'is_public')::boolean, false);
  v_funding    text := coalesce(nullif(p->>'funding', ''), 'personal');
  v_split_mode text := coalesce(nullif(p->>'split_mode', ''), 'household');
  v_paid_by    uuid := nullif(p->>'paid_by', '')::uuid;
  v_shares     jsonb := coalesce(p->'shares', '[]'::jsonb);
  v_share      jsonb;
  v_total      numeric := 0;
  v_n          int := 0;
begin
  if uid is null or hid is null then
    raise exception 'No perteneces a ningún hogar';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'El importe tiene que ser mayor que 0';
  end if;
  if not exists (select 1 from public.categories c where c.id = v_category and c.household_id = hid) then
    raise exception 'Categoría no válida';
  end if;

  if not v_is_shared then
    -- Gasto personal: lo pago yo, no se reparte
    v_paid_by := uid; v_funding := 'personal'; v_split_mode := 'household'; v_shares := '[]'::jsonb;
  elsif v_funding = 'pot' then
    -- Gasto del bote: no se reparte; user_id = quien lo apunta
    v_paid_by := uid; v_split_mode := 'household'; v_shares := '[]'::jsonb; v_is_public := false;
  else
    -- Gasto repartido: pagador miembro, partes de miembros, suma = importe
    v_is_public := false;
    if v_paid_by is null or not exists (
      select 1 from public.household_members m where m.household_id = hid and m.user_id = v_paid_by
    ) then
      raise exception 'El pagador tiene que ser miembro del hogar';
    end if;
    for v_share in select value from jsonb_array_elements(v_shares) loop
      if not exists (
        select 1 from public.household_members m
         where m.household_id = hid and m.user_id = (v_share->>'user_id')::uuid
      ) then
        raise exception 'El reparto incluye a alguien que no es del hogar';
      end if;
      if (v_share->>'amount')::numeric < 0 then
        raise exception 'Una parte no puede ser negativa';
      end if;
      v_total := v_total + (v_share->>'amount')::numeric;
      v_n := v_n + 1;
    end loop;
    if v_n = 0 then
      raise exception 'Falta indicar cómo se reparte';
    end if;
    if round(v_total, 2) <> v_amount then
      raise exception 'Las partes (%) no suman el importe (%)', round(v_total, 2), v_amount;
    end if;
  end if;

  if v_id is null then
    insert into public.expenses
      (household_id, user_id, amount, spent_on, category_id, description, is_shared, is_public, funding, split_mode)
    values
      (hid, v_paid_by, v_amount, v_spent_on, v_category, v_desc, v_is_shared, v_is_public, v_funding, v_split_mode)
    returning id into v_id;
  else
    if not exists (
      select 1 from public.expenses e
       where e.id = v_id and e.household_id = hid and (e.is_shared or e.user_id = uid)
    ) then
      raise exception 'No puedes editar este gasto';
    end if;
    update public.expenses e
       set user_id = v_paid_by, amount = v_amount, spent_on = v_spent_on, category_id = v_category,
           description = v_desc, is_shared = v_is_shared, is_public = v_is_public,
           funding = v_funding, split_mode = v_split_mode
     where e.id = v_id;
    delete from public.expense_shares es where es.expense_id = v_id;
  end if;

  insert into public.expense_shares (expense_id, user_id, amount)
  select v_id, (sh.value->>'user_id')::uuid, round((sh.value->>'amount')::numeric, 2)
    from jsonb_array_elements(v_shares) as sh;

  return v_id;
end
$$;
revoke execute on function public.save_expense(jsonb) from public, anon;
grant  execute on function public.save_expense(jsonb) to authenticated;

insert into public.schema_migrations (filename) values ('0003_fix_save_expense.sql')
on conflict (filename) do nothing;
