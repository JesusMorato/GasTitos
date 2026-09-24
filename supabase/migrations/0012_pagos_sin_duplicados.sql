-- ============================================================
-- GasTitos · 0012 · Pagos detectados sin duplicados entre Apple Pay y el banco
--   Un mismo pago puede llegar por dos caminos: la automatización "Transacción"
--   (Apple Pay) y la del aviso del banco (o el atajo manual). Cada camino escribe la
--   tienda a su manera y el aviso del banco puede tardar unos minutos, así que la regla
--   de 0009 (mismo importe y misma tienda en dos minutos) no los junta.
--   Regla nueva de register_payment: es el mismo pago si coincide el importe y
--     · llega por OTRO camino (otra "tarjeta") en los últimos 10 minutos, se llame
--       como se llame la tienda; o
--     · llega por el mismo camino con la misma tienda en 2 minutos (atajo doble, como antes).
--   Si el que ya estaba no tenía tienda, se le pone la del repetido.
--   Los pagos de prueba de Ajustes (tarjeta "Prueba") no se cruzan con los reales.
-- ============================================================

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
  s          public.payment_settings%rowtype;
  v_amount   numeric;
  v_at       timestamptz := now();
  v_merchant text := left(trim(coalesce(p_merchant, '')), 80);
  v_card     text := left(trim(coalesce(p_card, '')), 60);
  v_id       uuid;
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

  -- ¿Ya ha llegado este pago? (aunque ya esté apuntado o descartado)
  select d.id into v_id from public.detected_payments d
   where d.user_id = s.user_id and d.amount = v_amount
     and (
       -- Por otro camino (Apple Pay ↔ aviso del banco ↔ atajo manual) en 10 minutos
       (lower(d.card) <> lower(v_card)
         and lower(d.card) <> 'prueba' and lower(v_card) <> 'prueba'
         and d.created_at > now() - interval '10 minutes')
       -- Por el mismo camino, misma tienda, en 2 minutos (el atajo se ha disparado doble)
       or (lower(trim(d.merchant)) = lower(v_merchant)
         and d.created_at > now() - interval '2 minutes')
     )
   order by d.created_at desc
   limit 1;
  if v_id is not null then
    update public.detected_payments
       set merchant = v_merchant
     where id = v_id and merchant = '' and v_merchant <> '';
    return 'repetido';
  end if;

  -- Limpieza: descartados de más de 90 días y apuntados de más de un año. Los apuntados
  -- se guardan más tiempo porque son la "memoria" de cada comercio (tipo y categoría).
  delete from public.detected_payments d
   where d.user_id = s.user_id
     and ((d.status = 'dismissed' and d.created_at < now() - interval '90 days')
       or (d.status = 'done' and d.created_at < now() - interval '365 days'));

  insert into public.detected_payments (household_id, user_id, amount, merchant, card, paid_at)
  values (s.household_id, s.user_id, v_amount, v_merchant, v_card, v_at);
  return 'ok';
end
$$;

insert into public.schema_migrations (filename) values ('0012_pagos_sin_duplicados.sql')
on conflict (filename) do nothing;
