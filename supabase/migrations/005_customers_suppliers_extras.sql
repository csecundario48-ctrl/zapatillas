-- Fase 1: extra contact fields for customers and suppliers

alter table customers
  add column if not exists instagram text;

alter table suppliers
  add column if not exists address text;

-- Helpful indexes for the new management screens
create index if not exists sales_customer_id_idx on sales (customer_id);
create index if not exists purchases_supplier_id_idx on purchases (supplier_id);
