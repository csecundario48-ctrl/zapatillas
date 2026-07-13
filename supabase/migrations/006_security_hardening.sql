-- Hardening de seguridad y performance.
-- Aplicar en el SQL Editor de Supabase (después de 0001_rls_policies.sql).
-- Idempotente: se puede correr varias veces y no falla si los triggers
-- de 002_triggers.sql nunca se aplicaron en esta base.

-- 1. Si existen funciones SECURITY DEFINER, fijarles search_path:
--    sin esto, un search_path manipulado puede hacer que resuelvan
--    tablas/operadores de otro esquema con privilegios elevados.
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'get_user_role', 'handle_sale_item_insert', 'handle_sale_item_delete',
    'handle_purchase_item_insert', 'handle_stock_adjustment_insert', 'handle_new_user'
  ] loop
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    ) then
      execute format('alter function public.%I() set search_path = public', fn);
    end if;
  end loop;
end $$;

-- 2. Auditoría: created_by se completa solo con el usuario autenticado
--    aunque el insert venga del cliente y no lo mande.
alter table sales alter column created_by set default auth.uid();
alter table purchases alter column created_by set default auth.uid();
alter table expenses alter column created_by set default auth.uid();
alter table stock_adjustments alter column created_by set default auth.uid();

-- 3. Índices para las consultas del dashboard y los listados.
create index if not exists sales_sale_date_idx on sales (sale_date);
create index if not exists sales_status_date_idx on sales (status, sale_date);
create index if not exists sales_created_at_idx on sales (created_at desc);
create index if not exists expenses_expense_date_idx on expenses (expense_date desc);
create index if not exists sale_items_sale_id_idx on sale_items (sale_id);
create index if not exists purchase_items_purchase_id_idx on purchase_items (purchase_id);
create index if not exists purchases_payment_status_idx on purchases (payment_status, payment_due_date);

-- NOTA: 007_product_variants.sql reemplazó product_id por variant_id en
-- sale_items, purchase_items y stock_adjustments. Estos índices se corrigieron
-- para apuntar a variant_id (antes fallaban con "column product_id does not exist").
create index if not exists sale_items_variant_id_idx on sale_items (variant_id);
create index if not exists purchase_items_variant_id_idx on purchase_items (variant_id);
create index if not exists stock_adjustments_variant_id_idx on stock_adjustments (variant_id);
