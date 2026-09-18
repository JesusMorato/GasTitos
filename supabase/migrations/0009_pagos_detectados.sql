-- ============================================================
-- GasTitos · 0009 · Pagos detectados (Apple Pay → Atajos → GasTitos)
--   payment_settings:  un código secreto por usuario (lo usa el atajo del iPhone)
--                      y el tipo de gasto que se propone para cada tarjeta.
--   detected_payments: los pagos que llegan desde el atajo, pendientes de apuntar.
--   register_payment:  función pública (se llama con la clave anon) que recibe el
--                      pago; el código secreto es lo que identifica al usuario.
-- ============================================================

-- ---------- ajustes por usuario ----------
create table if not exists public.payment_settings (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  token        text not null unique check (length(token) >= 16),
  -- { "Revolut": "pot", "Bankinter": "personal" } — tipo propuesto según la tarjeta
  card_kinds   jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
alter table public.payment_settings enable row level security;

drop policy if exists payment_settings_select on public.payment_settings;
create policy payment_settings_select on public.payment_settings
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists payment_settings_insert on public.payment_settings;
create policy payment_settings_insert on public.payment_settings
  for insert to authenticated
  with check (user_id = auth.uid() and household_id = public.current_household_id());

drop policy if exists payment_settings_update on public.payment_settings;
create policy payment_settings_update on public.payment_settings
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and household_id = public.current_household_id());

-- ---------- pagos detectados ----------
create table if not exists public.detected_payments (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  merchant     text not null default '',
  card         text not null default '',
  paid_at      timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending', 'done', 'dismissed')),
  expense_id   uuid references public.expenses(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists detected_payments_user_idx on public.detected_payments (user_id, status);
alter table public.detected_payments enable row level security;

-- Cada uno ve y cambia solo los suyos. Se insertan únicamente con register_payment.
drop policy if exists detected_select on public.detected_payments;
create policy detected_select on public.detected_payments
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists detected_update on public.detected_payments;
create policy detected_update on public.detected_payments
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists detected_delete on public.detected_payments;
create policy detected_delete on public.detected_payments
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------- importe en texto → número ----------
-- El atajo manda el importe como texto y en formato español: "12,34 €", "1.234,56 €".
-- También se aceptan "12.34" y "-12,34" (devoluciones: se guarda en positivo).
create or replace function public.parse_amount(p text)
returns numeric
language plpgsql immutable
as $$
declare
  t text := regexp_replace(coalesce(p, ''), '[^0-9,.]', '', 'g');
begin
  if t = '' then return null; end if;
  if position(',' in t) > 0 and position('.' in t) > 0 then
    -- Hay coma y punto: el que va más a la derecha es el decimal
    if strpos(reverse(t), ',') < strpos(reverse(t), '.') then
      t := replace(t, '.', '');          -- 1.234,56
      t := replace(t, ',', '.');
    else
      t := replace(t, ',', '');          -- 1,234.56
    end if;
  elsif position(',' in t) > 0 then
    t := replace(t, ',', '.');           -- 12,34
  elsif t ~ '^\d{1,3}(\.\d{3})+$' then
    t := replace(t, '.', '');            -- 1.234 (miles a la española)
  end if;
  return round(t::numeric, 2);
exception when others then
  return null;
end
$$;

-- ---------- recibir un pago ----------
-- La llama el atajo del iPhone con la clave pública (anon). El código secreto
-- identifica al usuario; sin él no se puede insertar nada.
create or replace function public.register_payment(
  p_token text,
  p_amount text,
  p_merchant text default '',
  p_card text default '',
  p_at text default null
)
returns text
language plpgsql security definer
set search_path = public
as $$
declare
  s        public.payment_settings%rowtype;
  v_amount numeric;
  v_at     timestamptz := now();
  v_id     uuid;
begin
  if p_token is null or length(p_token) < 16 then
    raise exception 'Código no válido';
  end if;
  select * into s from public.payment_settings where token = p_token;
  if not found then
    raise exception 'Código no válido';
  end if;

  v_amount := abs(public.parse_amount(p_amount));
  if v_amount is null or v_amount <= 0 then
    raise exception 'Importe no válido: %', coalesce(p_amount, '');
  end if;

  if p_at is not null and trim(p_at) <> '' then
    begin
      v_at := p_at::timestamptz;
    exception when others then
      v_at := now();
    end;
  end if;

  -- El mismo pago dos veces en dos minutos (el atajo se ha disparado doble): se ignora.
  select id into v_id from public.detected_payments d
   where d.user_id = s.user_id and d.amount = v_amount
     and lower(trim(d.merchant)) = lower(trim(coalesce(p_merchant, '')))
     and d.created_at > now() - interval '2 minutes'
   limit 1;
  if v_id is not null then
    return 'repetido';
  end if;

  insert into public.detected_payments (household_id, user_id, amount, merchant, card, paid_at)
  values (s.household_id, s.user_id, v_amount, left(trim(coalesce(p_merchant, '')), 80), left(trim(coalesce(p_card, '')), 60), v_at);
  return 'ok';
end
$$;
revoke execute on function public.register_payment(text, text, text, text, text) from public;
grant  execute on function public.register_payment(text, text, text, text, text) to anon, authenticated;
revoke execute on function public.parse_amount(text) from public;
grant  execute on function public.parse_amount(text) to anon, authenticated;

insert into public.schema_migrations (filename) values ('0009_pagos_detectados.sql')
on conflict (filename) do nothing;
