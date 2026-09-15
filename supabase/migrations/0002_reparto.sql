-- ============================================================
-- GasTitos · 0002 · Reparto real, categorías con emoji, bote
--   - Categorías por hogar (nombre, emoji, color) editables
--   - Porcentaje de reparto por miembro (50/50 por defecto)
--   - Origen del dinero de un gasto: personal o bote (cuenta conjunta)
--   - Parte de cada uno en los gastos repartidos (expense_shares)
--   - Liquidaciones (settlements): "Ana pagó X a Luis"
--   - Emoji y color en las huchas
--   - Función save_expense() que guarda gasto + reparto de una vez
-- Idempotente: se puede ejecutar varias veces.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Categorías por hogar
-- ------------------------------------------------------------
create table if not exists public.categories (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name         text not null,
  emoji        text not null default '📦',
  color        text not null default '#6b7772',
  sort_order   int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (household_id, name)
);
alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (household_id = public.current_household_id());
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories
  for insert to authenticated with check (household_id = public.current_household_id());
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories
  for delete to authenticated using (household_id = public.current_household_id());

-- Categorías por defecto para un hogar nuevo (o para uno que no tenga ninguna)
create or replace function public.seed_default_categories(p_household uuid)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.categories (household_id, name, emoji, color, sort_order) values
    (p_household, 'Casa',          '🏠', '#5b7fa6', 10),
    (p_household, 'Comida',        '🍽️', '#c8553d', 20),
    (p_household, 'Transporte',    '🚌', '#3a8f8f', 30),
    (p_household, 'Ocio',          '🎉', '#b05aa0', 40),
    (p_household, 'Salud',         '💊', '#4f9a6a', 50),
    (p_household, 'Ropa',          '👕', '#c48a2e', 60),
    (p_household, 'Regalos',       '🎁', '#d0587a', 70),
    (p_household, 'Viajes',        '✈️', '#3c7bd1', 80),
    (p_household, 'Suscripciones', '📱', '#6b6bc4', 90),
    (p_household, 'Otros',         '📦', '#7a857f', 100)
  on conflict (household_id, name) do nothing;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- Hogares ya existentes: darles las categorías por defecto
do $$
declare h record;
begin
  for h in select id from public.households loop
    perform public.seed_default_categories(h.id);
  end loop;
end $$;

-- create_household ahora también siembra categorías
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
  perform public.seed_default_categories(hid);
  return hid;
end
$$;

-- ------------------------------------------------------------
-- 2. Gastos: categoría por id, origen del dinero, modo de reparto
-- ------------------------------------------------------------
alter table public.expenses
  add column if not exists category_id uuid references public.categories(id) on delete restrict;

-- Pasar el texto antiguo de categoría a su id (si aún existe la columna)
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'expenses' and column_name = 'category') then
    update public.expenses e
       set category_id = c.id
      from public.categories c
     where c.household_id = e.household_id and c.name = e.category and e.category_id is null;
    update public.expenses e
       set category_id = c.id
      from public.categories c
     where c.household_id = e.household_id and c.name = 'Otros' and e.category_id is null;
    alter table public.expenses drop column category;
  end if;
end $$;

alter table public.expenses alter column category_id set not null;

alter table public.expenses
  add column if not exists funding text not null default 'personal'
    check (funding in ('personal', 'pot'));
alter table public.expenses
  add column if not exists split_mode text not null default 'household'
    check (split_mode in ('household', 'equal', 'custom', 'exact', 'other_only'));

-- ------------------------------------------------------------
-- 3. Porcentaje de reparto por miembro
-- ------------------------------------------------------------
alter table public.household_members
  add column if not exists share_pct numeric(5,2) not null default 50
    check (share_pct >= 0 and share_pct <= 100);

-- Fija mi porcentaje y ajusta el de mi pareja para que sumen 100
create or replace function public.set_household_split(p_my_pct numeric)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
begin
  if auth.uid() is null or hid is null then
    raise exception 'No perteneces a ningún hogar';
  end if;
  if p_my_pct < 0 or p_my_pct > 100 then
    raise exception 'El porcentaje tiene que estar entre 0 y 100';
  end if;
  update public.household_members set share_pct = round(p_my_pct, 2)
   where household_id = hid and user_id = auth.uid();
  update public.household_members set share_pct = round(100 - p_my_pct, 2)
   where household_id = hid and user_id <> auth.uid();
end
$$;
revoke execute on function public.set_household_split(numeric) from public, anon;
grant  execute on function public.set_household_split(numeric) to authenticated;

-- ------------------------------------------------------------
-- 4. Parte de cada uno en un gasto repartido
-- ------------------------------------------------------------
create table if not exists public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(12,2) not null check (amount >= 0),
  primary key (expense_id, user_id)
);
alter table public.expense_shares enable row level security;

-- Se ven si se ve el gasto. Se escriben solo a través de save_expense().
drop policy if exists shares_select on public.expense_shares;
create policy shares_select on public.expense_shares
  for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_shares.expense_id));

-- Gastos compartidos que ya existían: repartirlos a partes iguales
do $$
declare
  e record;
  n int;
  per numeric(12,2);
  acc numeric(12,2);
  m record;
  i int;
begin
  for e in
    select x.id, x.amount, x.household_id
      from public.expenses x
     where x.is_shared and x.funding = 'personal'
       and not exists (select 1 from public.expense_shares s where s.expense_id = x.id)
  loop
    select count(*) into n from public.household_members where household_id = e.household_id;
    if n = 0 then continue; end if;
    per := round(e.amount / n, 2);
    acc := 0; i := 0;
    for m in select user_id from public.household_members where household_id = e.household_id order by joined_at loop
      i := i + 1;
      if i = n then
        insert into public.expense_shares (expense_id, user_id, amount) values (e.id, m.user_id, e.amount - acc);
      else
        insert into public.expense_shares (expense_id, user_id, amount) values (e.id, m.user_id, per);
        acc := acc + per;
      end if;
    end loop;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Liquidaciones
-- ------------------------------------------------------------
create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user    uuid not null references auth.users(id) on delete cascade,
  to_user      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  settled_on   date not null default current_date,
  note         text,
  created_at   timestamptz not null default now(),
  check (from_user <> to_user)
);
create index if not exists settlements_household_idx on public.settlements (household_id, settled_on desc);
alter table public.settlements enable row level security;

drop policy if exists settlements_select on public.settlements;
create policy settlements_select on public.settlements
  for select to authenticated using (household_id = public.current_household_id());

drop policy if exists settlements_insert on public.settlements;
create policy settlements_insert on public.settlements
  for insert to authenticated
  with check (
    household_id = public.current_household_id()
    and (from_user = auth.uid() or to_user = auth.uid())
    and exists (select 1 from public.household_members m where m.household_id = settlements.household_id and m.user_id = settlements.from_user)
    and exists (select 1 from public.household_members m where m.household_id = settlements.household_id and m.user_id = settlements.to_user)
  );

drop policy if exists settlements_delete on public.settlements;
create policy settlements_delete on public.settlements
  for delete to authenticated using (household_id = public.current_household_id());

-- ------------------------------------------------------------
-- 6. Huchas con emoji y color
-- ------------------------------------------------------------
alter table public.savings_goals add column if not exists emoji text not null default '🎯';
alter table public.savings_goals add column if not exists color text not null default '#2f6f5e';

-- ------------------------------------------------------------
-- 7. save_expense: guarda un gasto y su reparto de una sola vez
-- ------------------------------------------------------------
-- p = {
--   id?, amount, spent_on, category_id, description?,
--   is_shared, is_public?, funding ('personal'|'pot'), split_mode,
--   paid_by? (uuid), shares?: [{user_id, amount}]
-- }
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
  s            jsonb;
  total        numeric := 0;
  n            int := 0;
begin
  if uid is null or hid is null then
    raise exception 'No perteneces a ningún hogar';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'El importe tiene que ser mayor que 0';
  end if;
  if not exists (select 1 from public.categories where id = v_category and household_id = hid) then
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
      select 1 from public.household_members where household_id = hid and user_id = v_paid_by
    ) then
      raise exception 'El pagador tiene que ser miembro del hogar';
    end if;
    for s in select * from jsonb_array_elements(v_shares) loop
      if not exists (
        select 1 from public.household_members where household_id = hid and user_id = (s->>'user_id')::uuid
      ) then
        raise exception 'El reparto incluye a alguien que no es del hogar';
      end if;
      if (s->>'amount')::numeric < 0 then
        raise exception 'Una parte no puede ser negativa';
      end if;
      total := total + (s->>'amount')::numeric;
      n := n + 1;
    end loop;
    if n = 0 then
      raise exception 'Falta indicar cómo se reparte';
    end if;
    if round(total, 2) <> v_amount then
      raise exception 'Las partes (%) no suman el importe (%)', round(total, 2), v_amount;
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
    update public.expenses
       set user_id = v_paid_by, amount = v_amount, spent_on = v_spent_on, category_id = v_category,
           description = v_desc, is_shared = v_is_shared, is_public = v_is_public,
           funding = v_funding, split_mode = v_split_mode
     where id = v_id;
    delete from public.expense_shares where expense_id = v_id;
  end if;

  insert into public.expense_shares (expense_id, user_id, amount)
  select v_id, (s->>'user_id')::uuid, round((s->>'amount')::numeric, 2)
    from jsonb_array_elements(v_shares) s;

  return v_id;
end
$$;
revoke execute on function public.save_expense(jsonb) from public, anon;
grant  execute on function public.save_expense(jsonb) to authenticated;

insert into public.schema_migrations (filename) values ('0002_reparto.sql')
on conflict (filename) do nothing;
