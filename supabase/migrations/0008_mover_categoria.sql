-- ============================================================
-- GasTitos · 0008 · Mover en bloque los gastos de una categoría a otra
--   move_category(desde, hasta, borrar): pasa todos los gastos y gastos fijos
--   del hogar de una categoría a otra y, si se pide, borra la de origen.
--   Va como security definer porque el usuario no puede tocar los gastos
--   personales privados de su pareja, pero sí hace falta moverlos para poder
--   borrar la categoría (que es común al hogar).
-- ============================================================

create or replace function public.move_category(p_from uuid, p_to uuid, p_delete boolean default false)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  hid uuid := public.current_household_id();
  n   int;
  m   int;
begin
  if auth.uid() is null or hid is null then
    raise exception 'No perteneces a ningún hogar';
  end if;
  if p_from = p_to then
    raise exception 'Elige una categoría distinta';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_from and c.household_id = hid)
     or not exists (select 1 from public.categories c where c.id = p_to and c.household_id = hid) then
    raise exception 'Categoría no válida';
  end if;

  update public.expenses e set category_id = p_to where e.category_id = p_from and e.household_id = hid;
  get diagnostics n = row_count;
  update public.recurring_expenses r set category_id = p_to where r.category_id = p_from and r.household_id = hid;
  get diagnostics m = row_count;

  if p_delete then
    delete from public.categories c where c.id = p_from and c.household_id = hid;
  end if;
  return n + m;
end
$$;
revoke execute on function public.move_category(uuid, uuid, boolean) from public, anon;
grant  execute on function public.move_category(uuid, uuid, boolean) to authenticated;

insert into public.schema_migrations (filename) values ('0008_mover_categoria.sql')
on conflict (filename) do nothing;
