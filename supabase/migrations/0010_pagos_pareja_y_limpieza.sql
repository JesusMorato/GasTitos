-- ============================================================
-- GasTitos · 0010 · Pagos detectados: cuántos tiene la pareja sin apuntar y limpieza
--   partner_pending_payments(): número de pagos pendientes de la OTRA persona del hogar
--     (solo el número; los detalles siguen siendo privados por RLS).
--   register_payment: además de guardar el pago, borra los descartados de más de 90 días
--     y los apuntados de más de un año del mismo usuario, para que la tabla no crezca.
-- ============================================================

create or replace function public.partner_pending_payments()
returns int
language sql security definer stable
set search_path = public
as $$
  select count(*)::int
    from public.detected_payments d
   where d.household_id = public.current_household_id()
     and d.user_id <> auth.uid()
     and d.status = 'pending';
$$;
revoke execute on function public.partner_pending_payments() from public, anon;
grant  execute on function public.partner_pending_payments() to authenticated;

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

  -- Limpieza: descartados de más de 90 días y apuntados de más de un año. Los apuntados
  -- se guardan más tiempo porque son la "memoria" de cada comercio (tipo y categoría).
  delete from public.detected_payments d
   where d.user_id = s.user_id
     and ((d.status = 'dismissed' and d.created_at < now() - interval '90 days')
       or (d.status = 'done' and d.created_at < now() - interval '365 days'));

  insert into public.detected_payments (household_id, user_id, amount, merchant, card, paid_at)
  values (s.household_id, s.user_id, v_amount, left(trim(coalesce(p_merchant, '')), 80), left(trim(coalesce(p_card, '')), 60), v_at);
  return 'ok';
end
$$;

insert into public.schema_migrations (filename) values ('0010_pagos_pareja_y_limpieza.sql')
on conflict (filename) do nothing;
