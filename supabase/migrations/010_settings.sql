-- =============================================================================
-- 010_settings.sql — Rediseño Fase 4 (Configuración)
-- Tablas de configuración editable: datos del negocio (fila única), rango de
-- talles, y categorías de gastos. Bucket de Storage 'business' para el logo.
-- Aplicar en Supabase Dashboard -> SQL Editor (con backup). Correr una sola vez.
-- =============================================================================

begin;

-- 1) Datos del negocio + rango de talles: tabla de UNA sola fila (singleton).
create table if not exists business_settings (
  id            int primary key default 1,
  business_name text not null default 'Mi Negocio',
  logo_url      text,
  size_min      int  not null default 35,
  size_max      int  not null default 45,
  updated_at    timestamptz not null default now(),
  constraint business_settings_singleton check (id = 1)
);
insert into business_settings (id) values (1) on conflict (id) do nothing;

-- 2) Categorías de gastos.
create table if not exists expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
insert into expense_categories (name)
  values ('alquiler'), ('servicios'), ('marketing'), ('delivery'),
         ('salarios'), ('packaging'), ('otros')
  on conflict (name) do nothing;

-- 3) Quitar el check que limitaba expenses.category al enum viejo.
alter table expenses drop constraint if exists expenses_category_check;

-- 4) RLS igual al resto del esquema: todo autenticado.
alter table business_settings   enable row level security;
alter table expense_categories  enable row level security;

drop policy if exists "auth_all_business_settings" on business_settings;
create policy "auth_all_business_settings" on business_settings
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_expense_categories" on expense_categories;
create policy "auth_all_expense_categories" on expense_categories
  for all to authenticated using (true) with check (true);

-- 5) Bucket público para el logo + policies en storage.objects.
insert into storage.buckets (id, name, public)
  values ('business', 'business', true)
  on conflict (id) do nothing;

drop policy if exists "business_public_read" on storage.objects;
create policy "business_public_read" on storage.objects
  for select using (bucket_id = 'business');

drop policy if exists "business_auth_write" on storage.objects;
create policy "business_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'business');

drop policy if exists "business_auth_update" on storage.objects;
create policy "business_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'business');

commit;
