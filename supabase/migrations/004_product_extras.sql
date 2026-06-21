-- Add extra fields to products for catalog management
alter table products
  add column if not exists description text,
  add column if not exists image_url text,
  add column if not exists discount_price numeric(10,2) check (discount_price is null or discount_price >= 0);

-- Index for faster brand/model searches
create index if not exists products_brand_model_idx on products (brand, model);
create index if not exists products_active_idx on products (active);
