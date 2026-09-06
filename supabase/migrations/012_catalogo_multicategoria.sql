-- =============================================================================
-- 012_catalogo_multicategoria.sql
-- Catálogo multi-categoría (zapatillas + ropa) con atributos propios por
-- categoría, más el rubro/línea transversal para separar la plata.
--
-- Fase A (catálogo):
--   - business_lines (rubros: Zapatillas, Ropa)
--   - product_categories (8 categorías, cada una con sus talles)
--   - category_attributes (campos propios por categoría → form dinámico)
--   - brands (marcas administrables; reemplazan la lista hardcodeada)
--   - products.category_id + products.attributes (jsonb)
--
-- Fase B (rubro en la plata):
--   - suppliers.line_id, expenses.line_id
--   - sale_items / purchase_items: line_id + category_label (snapshots)
--
-- Todo aditivo e idempotente. Nada de lo existente se borra ni cambia de lógica:
-- todos los productos actuales quedan en la categoría 'zapatillas' / rubro
-- 'Zapatillas', que es lo que son. Aplicar con:
--   npm run db:sql supabase/migrations/012_catalogo_multicategoria.sql
-- =============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Rubros / líneas de negocio
-- ---------------------------------------------------------------------------
create table if not exists business_lines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);

insert into business_lines (name, slug, sort_order) values
  ('Zapatillas', 'zapatillas', 0),
  ('Ropa',       'ropa',       1)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 2) Categorías de producto (cada una con su vocabulario de talles)
-- ---------------------------------------------------------------------------
create table if not exists product_categories (
  id           uuid primary key default gen_random_uuid(),
  line_id      uuid references business_lines(id),
  name         text not null,
  slug         text not null unique,
  size_options jsonb not null default '[]',
  sort_order   int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into product_categories (line_id, name, slug, size_options, sort_order)
values
  ((select id from business_lines where slug = 'zapatillas'),
    'Zapatillas', 'zapatillas',
    '["35","36","37","38","39","40","41","42","43","44","45"]'::jsonb, 0),
  ((select id from business_lines where slug = 'ropa'),
    'Pantalones', 'pantalones', '["S","M","L","XL","XXL"]'::jsonb, 1),
  ((select id from business_lines where slug = 'ropa'),
    'Remeras', 'remeras', '["S","M","L","XL","XXL"]'::jsonb, 2),
  ((select id from business_lines where slug = 'ropa'),
    'Buzos', 'buzos', '["S","M","L","XL","XXL"]'::jsonb, 3),
  ((select id from business_lines where slug = 'ropa'),
    'Camperas', 'camperas', '["S","M","L","XL","XXL"]'::jsonb, 4),
  ((select id from business_lines where slug = 'ropa'),
    'Shorts', 'shorts', '["S","M","L","XL","XXL"]'::jsonb, 5),
  ((select id from business_lines where slug = 'ropa'),
    'Gorras', 'gorras', '["Única","S/M","L/XL"]'::jsonb, 6),
  ((select id from business_lines where slug = 'ropa'),
    'Accesorios', 'accesorios', '["Única"]'::jsonb, 7)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Atributos por categoría (motor del formulario dinámico)
--    Solo los campos EXTRA: marca/modelo/color/género/costo/precio/talle son
--    universales (columnas) y no se listan acá.
-- ---------------------------------------------------------------------------
create table if not exists category_attributes (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references product_categories(id) on delete cascade,
  key         text not null,
  label       text not null,
  type        text not null check (type in ('text','number','select')),
  options     jsonb not null default '[]',
  required    boolean not null default false,
  filterable  boolean not null default false,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (category_id, key)
);

-- Helper de seed: inserta un atributo por (slug de categoría, key).
insert into category_attributes (category_id, key, label, type, options, required, filterable, sort_order)
values
  -- Zapatillas
  ((select id from product_categories where slug='zapatillas'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 0),
  -- Pantalones
  ((select id from product_categories where slug='pantalones'),
    'tipo', 'Tipo', 'select', '["Cargo","Baggy","Wide","Recto"]'::jsonb, false, true, 0),
  ((select id from product_categories where slug='pantalones'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 1),
  -- Remeras
  ((select id from product_categories where slug='remeras'),
    'corte', 'Corte', 'select', '["Oversize","Regular"]'::jsonb, false, true, 0),
  ((select id from product_categories where slug='remeras'),
    'manga', 'Manga', 'select', '["Corta","Larga"]'::jsonb, false, true, 1),
  ((select id from product_categories where slug='remeras'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 2),
  -- Buzos
  ((select id from product_categories where slug='buzos'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 0),
  -- Camperas
  ((select id from product_categories where slug='camperas'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 0),
  -- Shorts
  ((select id from product_categories where slug='shorts'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 0),
  -- Gorras
  ((select id from product_categories where slug='gorras'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 0),
  -- Accesorios
  ((select id from product_categories where slug='accesorios'),
    'material', 'Material', 'text', '[]'::jsonb, false, true, 0)
on conflict (category_id, key) do nothing;

-- ---------------------------------------------------------------------------
-- 4) Marcas administrables (reemplazan la lista hardcodeada de sizes.ts)
-- ---------------------------------------------------------------------------
create table if not exists brands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

insert into brands (name) values
  ('Nike'), ('Adidas'), ('Puma'), ('New Balance'), ('Converse'),
  ('Vans'), ('Fila'), ('Reebok'), ('Asics'), ('Skechers')
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- 5) products: categoría + atributos. Backfill de todo a 'zapatillas'.
-- ---------------------------------------------------------------------------
alter table products add column if not exists category_id uuid references product_categories(id);
alter table products add column if not exists attributes  jsonb not null default '{}';

update products
   set category_id = (select id from product_categories where slug = 'zapatillas')
 where category_id is null;

-- ---------------------------------------------------------------------------
-- 6) Rubro transversal en la plata (nullable = general/compartido)
-- ---------------------------------------------------------------------------
alter table suppliers add column if not exists line_id uuid references business_lines(id);
alter table expenses  add column if not exists line_id uuid references business_lines(id);

-- Snapshots de rubro/categoría en los items (robustos aun si se borra el
-- producto). El histórico existente es todo de zapatillas.
alter table sale_items     add column if not exists line_id        uuid references business_lines(id);
alter table sale_items     add column if not exists category_label text;
alter table purchase_items add column if not exists line_id        uuid references business_lines(id);
alter table purchase_items add column if not exists category_label text;

update sale_items
   set line_id = (select id from business_lines where slug = 'zapatillas'),
       category_label = 'Zapatillas'
 where line_id is null;

update purchase_items
   set line_id = (select id from business_lines where slug = 'zapatillas'),
       category_label = 'Zapatillas'
 where line_id is null;

-- ---------------------------------------------------------------------------
-- 7) Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_products_category          on products(category_id);
create index if not exists idx_product_categories_line    on product_categories(line_id);
create index if not exists idx_category_attributes_cat    on category_attributes(category_id);
create index if not exists idx_suppliers_line             on suppliers(line_id);
create index if not exists idx_expenses_line              on expenses(line_id);
create index if not exists idx_sale_items_line            on sale_items(line_id);
create index if not exists idx_purchase_items_line        on purchase_items(line_id);

-- ---------------------------------------------------------------------------
-- 8) RLS: mismo patrón auth_all del resto del esquema (todo autenticado).
-- ---------------------------------------------------------------------------
alter table business_lines      enable row level security;
alter table product_categories  enable row level security;
alter table category_attributes enable row level security;
alter table brands              enable row level security;

drop policy if exists "auth_all_business_lines" on business_lines;
create policy "auth_all_business_lines" on business_lines
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_product_categories" on product_categories;
create policy "auth_all_product_categories" on product_categories
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_category_attributes" on category_attributes;
create policy "auth_all_category_attributes" on category_attributes
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_brands" on brands;
create policy "auth_all_brands" on brands
  for all to authenticated using (true) with check (true);

commit;
