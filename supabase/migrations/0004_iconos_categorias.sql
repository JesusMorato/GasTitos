-- ============================================================
-- GasTitos · 0004 · Iconos de categoría "estilo GasTitos"
-- Cada categoría puede llevar, además del emoji, un icono del juego propio
-- (una clave de texto: casa, comida, transporte…). La app dibuja el icono si
-- hay clave y el emoji si no. Las categorías de serie pasan a usar su icono y
-- el color de la paleta que le corresponde.
-- ============================================================

alter table public.categories add column if not exists icon text;

-- Las categorías por defecto de un hogar nuevo ya nacen con icono
create or replace function public.seed_default_categories(p_household uuid)
returns void
language sql security definer
set search_path = public
as $$
  insert into public.categories (household_id, name, emoji, color, icon, sort_order) values
    (p_household, 'Casa',          '🏠', '#5b7fa6', 'casa',          10),
    (p_household, 'Comida',        '🍽️', '#c8553d', 'comida',        20),
    (p_household, 'Transporte',    '🚌', '#3a8f8f', 'transporte',    30),
    (p_household, 'Ocio',          '🎉', '#b05aa0', 'ocio',          40),
    (p_household, 'Salud',         '💊', '#4f9a6a', 'salud',         50),
    (p_household, 'Ropa',          '👕', '#c48a2e', 'ropa',          60),
    (p_household, 'Regalos',       '🎁', '#d0587a', 'regalos',       70),
    (p_household, 'Viajes',        '✈️', '#3c7bd1', 'viajes',        80),
    (p_household, 'Suscripciones', '📱', '#6b6bc4', 'suscripciones', 90),
    (p_household, 'Otros',         '📦', '#7a857f', 'otros',         100)
  on conflict (household_id, name) do nothing;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- Categorías ya existentes con nombre de las de serie: se les pone el icono y
-- su color. Solo si aún no tienen icono, para no pisar cambios posteriores.
update public.categories c
set icon = d.icon, color = d.color
from (values
  ('casa',          'casa',          '#5b7fa6'),
  ('comida',        'comida',        '#c8553d'),
  ('transporte',    'transporte',    '#3a8f8f'),
  ('ocio',          'ocio',          '#b05aa0'),
  ('salud',         'salud',         '#4f9a6a'),
  ('ropa',          'ropa',          '#c48a2e'),
  ('regalos',       'regalos',       '#d0587a'),
  ('viajes',        'viajes',        '#3c7bd1'),
  ('suscripciones', 'suscripciones', '#6b6bc4'),
  ('otros',         'otros',         '#7a857f')
) as d(nombre, icon, color)
where c.icon is null and lower(trim(c.name)) = d.nombre;

insert into public.schema_migrations (filename) values ('0004_iconos_categorias.sql')
on conflict (filename) do nothing;
