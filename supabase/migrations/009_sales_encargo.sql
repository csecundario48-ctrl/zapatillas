-- =============================================================================
-- 009_sales_encargo.sql — Rediseño Fase 3
-- Agrega el estado 'encargo' y la seña (deposit_amount) a las ventas.
-- Un encargo es una venta con seña por un producto sin stock: no mueve stock
-- ni cuenta como ingreso hasta que se completa (o se cancela, reteniendo la seña).
-- Aplicar en Supabase Dashboard -> SQL Editor (con backup). Correr una sola vez.
-- =============================================================================

begin;

alter table sales
  add column deposit_amount numeric not null default 0
  check (deposit_amount >= 0);

-- Ampliar el check de status para incluir 'encargo'.
-- Si el constraint tiene otro nombre en tu base, ajustá el drop.
alter table sales
  drop constraint if exists sales_status_check;

alter table sales
  add constraint sales_status_check
  check (status in ('completada', 'cancelada', 'devolucion', 'encargo'));

commit;
