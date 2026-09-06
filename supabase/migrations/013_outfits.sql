-- =============================================================================
-- 013_outfits.sql
-- Módulo de Outfits: un outfit es un conjunto de productos con nombre. De ahí se
-- derivan los "productos relacionados" (los que comparten algún outfit) y los
-- favoritos. Aditivo e idempotente; nada de lo existente cambia. Aplicar con:
--   Supabase -> SQL Editor -> pegar y Run
-- =============================================================================

begin;

-- 1) Outfits
create table if not exists outfits (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  notes      text,
  favorite   boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- 2) Productos que forman cada outfit
create table if not exists outfit_items (
  id         uuid primary key default gen_random_uuid(),
  outfit_id  uuid not null references outfits(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sort_order int  not null default 0,
  created_at timestamptz not null default now(),
  unique (outfit_id, product_id)
);

create index if not exists idx_outfit_items_outfit  on outfit_items(outfit_id);
create index if not exists idx_outfit_items_product on outfit_items(product_id);

-- 3) RLS: mismo patrón auth_all del resto del esquema (todo autenticado).
alter table outfits      enable row level security;
alter table outfit_items enable row level security;

drop policy if exists "auth_all_outfits" on outfits;
create policy "auth_all_outfits" on outfits
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_outfit_items" on outfit_items;
create policy "auth_all_outfit_items" on outfit_items
  for all to authenticated using (true) with check (true);

commit;
