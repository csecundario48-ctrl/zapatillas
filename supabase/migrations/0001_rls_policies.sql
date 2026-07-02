-- =============================================================================
-- RLS (Row Level Security) para el panel KALA
-- =============================================================================
-- CONTEXTO: la app escribe a Supabase desde el navegador con la ANON KEY, que es
-- pública (viaja en el bundle). Sin RLS, cualquiera con esa key puede leer y
-- modificar TODA la base sin loguearse. Este script exige usuario autenticado
-- para toda operación. Es una herramienta interna: todo el personal logueado
-- puede operar; los anónimos no pueden nada.
--
-- CÓMO APLICAR: Supabase Dashboard -> SQL Editor -> pegar y Run.
-- Es idempotente (se puede correr varias veces).
-- =============================================================================

-- 1) Habilitar RLS en todas las tablas de negocio
alter table public.suppliers          enable row level security;
alter table public.products           enable row level security;
alter table public.customers          enable row level security;
alter table public.sales              enable row level security;
alter table public.sale_items         enable row level security;
alter table public.purchases          enable row level security;
alter table public.purchase_items     enable row level security;
alter table public.expenses           enable row level security;
alter table public.stock_adjustments  enable row level security;
alter table public.user_profiles      enable row level security;

-- 2) Política común: solo usuarios autenticados, acceso total a tablas de negocio
do $$
declare
  t text;
  business_tables text[] := array[
    'suppliers','products','customers','sales','sale_items',
    'purchases','purchase_items','expenses','stock_adjustments'
  ];
begin
  foreach t in array business_tables loop
    execute format('drop policy if exists "auth_all_%1$s" on public.%1$s;', t);
    execute format($f$
      create policy "auth_all_%1$s" on public.%1$s
        for all
        to authenticated
        using (true)
        with check (true);
    $f$, t);
  end loop;
end $$;

-- 3) user_profiles: cada usuario ve su propio perfil; nadie cambia su rol desde el cliente
drop policy if exists "profiles_self_read" on public.user_profiles;
create policy "profiles_self_read" on public.user_profiles
  for select to authenticated
  using (id = auth.uid());

-- (Los cambios de rol se hacen desde el panel de Supabase o con la service_role,
--  nunca desde el navegador.)

-- =============================================================================
-- OPCIONAL PERO RECOMENDADO: venta atómica a prueba de sobreventa concurrente
-- =============================================================================
-- La app hoy registra la venta y descuenta stock desde una server action
-- (src/app/actions/sales.ts). Es correcto para un local con poca concurrencia,
-- pero dos ventas simultáneas del último par podrían sobrevender.
--
-- Esta función hace todo en UNA transacción con bloqueo de fila. Si querés
-- usarla, descomentala, corré el script, y en createSale reemplazá la lógica
-- por: await supabase.rpc('create_sale', { ... }).
--
-- create or replace function public.create_sale(
--   p_customer_id uuid,
--   p_sale_date date,
--   p_channel text,
--   p_payment_method text,
--   p_items jsonb   -- [{ "product_id": "...", "quantity": 1, "unit_price": 0, "discount": 0 }]
-- ) returns uuid
-- language plpgsql
-- security invoker
-- as $$
-- declare
--   v_sale_id uuid;
--   v_total numeric := 0;
--   v_item jsonb;
--   v_stock int;
-- begin
--   if auth.uid() is null then
--     raise exception 'No autenticado';
--   end if;
--
--   -- Validar stock con bloqueo de fila y calcular total
--   for v_item in select * from jsonb_array_elements(p_items) loop
--     select stock_quantity into v_stock
--       from public.products
--       where id = (v_item->>'product_id')::uuid
--       for update;
--     if v_stock is null then raise exception 'Producto inexistente'; end if;
--     if v_stock < (v_item->>'quantity')::int then
--       raise exception 'Stock insuficiente';
--     end if;
--     v_total := v_total +
--       ((v_item->>'unit_price')::numeric - (v_item->>'discount')::numeric)
--       * (v_item->>'quantity')::int;
--   end loop;
--
--   insert into public.sales (customer_id, sale_date, channel, payment_method, total_amount, status, created_by)
--   values (p_customer_id, p_sale_date, p_channel, p_payment_method, v_total, 'completada', auth.uid())
--   returning id into v_sale_id;
--
--   for v_item in select * from jsonb_array_elements(p_items) loop
--     insert into public.sale_items (sale_id, product_id, quantity, unit_price, discount, subtotal)
--     values (
--       v_sale_id,
--       (v_item->>'product_id')::uuid,
--       (v_item->>'quantity')::int,
--       (v_item->>'unit_price')::numeric,
--       (v_item->>'discount')::numeric,
--       ((v_item->>'unit_price')::numeric - (v_item->>'discount')::numeric) * (v_item->>'quantity')::int
--     );
--     update public.products
--       set stock_quantity = stock_quantity - (v_item->>'quantity')::int
--       where id = (v_item->>'product_id')::uuid;
--   end loop;
--
--   return v_sale_id;
-- end $$;
