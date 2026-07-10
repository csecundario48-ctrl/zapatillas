-- =============================================================================
-- 007_product_variants.sql — Rediseño Fase 1
-- Separa products (modelo+color) de product_variants (talle+stock).
-- Preserva datos. APLICAR UNA SOLA VEZ. Requiere backup previo.
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- =============================================================================

begin;

-- 1) Tabla de variantes (talle + stock). legacy_product_id es temporal.
create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sku text,
  legacy_product_id uuid,
  created_at timestamptz default now()
);

-- 2) Columna temporal para agrupar filas de products por modelo+color+genero.
alter table products add column parent_id uuid;

-- 3) Fila canonica por grupo = menor id (determinista).
update products p
set parent_id = sub.canonical_id
from (
  select brand, model, color, gender, min(id::text)::uuid as canonical_id
  from products
  group by brand, model, color, gender
) sub
where p.brand = sub.brand and p.model = sub.model
  and p.color = sub.color and p.gender is not distinct from sub.gender;

-- 4) Una variante por cada fila de products, colgando del canonico.
insert into product_variants (product_id, size, stock_quantity, sku, legacy_product_id)
select parent_id, size, stock_quantity, sku, id
from products;

-- 5) Snapshots + repunte de sale_items a variant_id (ANTES de borrar filas).
alter table sale_items add column variant_id uuid;
alter table sale_items add column product_label text;
alter table sale_items add column size_label text;

update sale_items si
set variant_id = v.id,
    product_label = p.brand || ' ' || p.model || ' ' || p.color,
    size_label = p.size
from products p
join product_variants v on v.legacy_product_id = p.id
where si.product_id = p.id;

-- 6) Idem purchase_items.
alter table purchase_items add column variant_id uuid;
alter table purchase_items add column product_label text;
alter table purchase_items add column size_label text;

update purchase_items pi
set variant_id = v.id,
    product_label = p.brand || ' ' || p.model || ' ' || p.color,
    size_label = p.size
from products p
join product_variants v on v.legacy_product_id = p.id
where pi.product_id = p.id;

-- 7) Idem stock_adjustments.
alter table stock_adjustments add column variant_id uuid;

update stock_adjustments sa
set variant_id = v.id
from product_variants v
where v.legacy_product_id = sa.product_id;

-- 8) Borrar filas de products no canonicas (ahora representadas como variantes).
delete from products where id <> parent_id;

-- 9) Reapuntar FKs y limpiar columnas viejas.
alter table sale_items drop constraint sale_items_product_id_fkey;
alter table sale_items add constraint sale_items_variant_id_fkey
  foreign key (variant_id) references product_variants(id) on delete set null;
alter table sale_items drop column product_id;

alter table purchase_items drop constraint purchase_items_product_id_fkey;
alter table purchase_items add constraint purchase_items_variant_id_fkey
  foreign key (variant_id) references product_variants(id) on delete set null;
alter table purchase_items drop column product_id;

alter table stock_adjustments drop constraint stock_adjustments_product_id_fkey;
alter table stock_adjustments add constraint stock_adjustments_variant_id_fkey
  foreign key (variant_id) references product_variants(id) on delete cascade;
alter table stock_adjustments alter column variant_id set not null;
alter table stock_adjustments drop column product_id;

-- 10) Limpiar products: quitar columnas que ahora viven en la variante.
alter table products drop column size;
alter table products drop column stock_quantity;
alter table products drop column sku;
alter table products drop column parent_id;
alter table products alter column gender drop not null;

-- 11) Finalizar product_variants.
alter table product_variants drop column legacy_product_id;
alter table product_variants add constraint product_variants_unique_size unique (product_id, size);
create index idx_product_variants_product on product_variants(product_id);

-- 12) RLS para la tabla nueva (mismo patron auth_all que las demas tablas de negocio).
alter table product_variants enable row level security;
drop policy if exists "auth_all_product_variants" on product_variants;
create policy "auth_all_product_variants" on product_variants
  for all to authenticated using (true) with check (true);

commit;
