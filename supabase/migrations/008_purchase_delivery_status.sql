-- =============================================================================
-- 008_purchase_delivery_status.sql — Rediseño Fase 2
-- Agrega estado de entrega a las compras: pedido (no suma stock) / recibido.
-- Las compras existentes quedan 'recibido' (ya sumaron stock en su momento).
-- Aplicar en Supabase Dashboard -> SQL Editor. Idempotente-seguro (add column
-- fallaria si ya existe; correr una sola vez).
-- =============================================================================

begin;

alter table purchases
  add column delivery_status text not null default 'recibido'
  check (delivery_status in ('pedido', 'recibido'));

commit;
