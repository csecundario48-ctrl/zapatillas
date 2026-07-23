# Compra automática al cargar stock

Cuando se suma stock a un producto, se registra automáticamente como una compra al proveedor, en vez de requerir que el usuario la cargue por separado en `/compras`.

## Objetivo

Hoy hay dos formas de sumar stock que **no** generan una compra:

1. `/stock` → ajustar un talle con cambio positivo (`AdjustmentForm` → `adjustStock`, motivo `ajuste_manual`).
2. Catálogo → crear/editar un producto con stock por talle (`createProduct`/`updateProduct`).

Esto obliga a cargar la compra dos veces (una en el ajuste/producto, otra manualmente en `/compras`) o directamente a no llevar el historial de compras al día. El objetivo es que **toda suba de stock** (salvo movimientos negativos como rotura, pérdida o devolución) quede registrada como compra a un proveedor, sin duplicar la carga.

## Alcance

- Sin migraciones nuevas: `purchases`/`purchase_items` ya soportan todo lo necesario.
- Afecta: `/stock` (ajuste por talle) y Catálogo (alta y edición de producto).
- **Fuera de alcance**: el flujo de `/compras` en sí (crear/editar/borrar/marcar recibida) no cambia. Los movimientos negativos de stock (rotura, pérdida, devolución a proveedor, corrección a la baja) siguen generando `stock_adjustments` como hoy, sin tocar compras.

## Decisiones de diseño

### 1. `/stock` — ajuste por talle

`AdjustmentForm` cambia de comportamiento según el signo del cambio:

- **Cambio positivo** (sumás unidades): en vez del selector "Motivo", se muestran **Proveedor** (precargado con `product.supplier_id` si existe, obligatorio) y **Costo unitario** (precargado con `product.cost_price`, editable). Al confirmar, se llama a `createPurchase` con un solo ítem (`delivery_status: 'recibido'`, `payment_status: 'pendiente'`, fecha = hoy), que ya suma el stock e inserta la compra. No se llama a `adjustStock`.
- **Cambio negativo o cero-hacia-abajo**: sigue igual que hoy — selector de motivo (`ajuste_manual`, `rotura`, `perdida`, `devolucion_proveedor`) y `adjustStock`/`stock_adjustments`. Sin cambios.
- Si el producto no tiene proveedor asignado y el cambio es positivo, el selector de proveedor queda vacío y es obligatorio elegir uno antes de confirmar (bloqueo de cliente, mismo patrón que "Agregá al menos un producto" en `purchase-form.tsx`).

### 2. Catálogo — crear/editar producto

El campo "Costo" ya existente en `ProductForm` se reutiliza como costo unitario de la compra (no se agrega un campo nuevo).

- **`createProduct`**: los talles con `stock_quantity > 0` en el alta se agrupan en **una compra** (un ítem por talle) al proveedor elegido en el form, además de insertarse las variantes con su stock ya en el valor final (comportamiento actual, sin cambios). La compra se inserta como registro adicional; **no** vuelve a sumar stock (ya quedó seteado al insertar la variante).
- **`updateProduct`**: para cada talle, se compara stock viejo vs. nuevo como hoy:
  - **Delta positivo** → en vez del `stock_adjustment` que se generaba hoy, ese ítem entra a una compra nueva (agrupando todos los deltas positivos de esa edición en una sola compra al proveedor del producto). No se genera `stock_adjustment` para ese talle.
  - **Delta negativo** → sigue generando `stock_adjustment` (`ajuste_manual`, nota "Corrección desde catálogo"), sin cambios.
- Si hay algún delta positivo (alta o edición) y el producto no tiene `supplier_id`, se bloquea el guardado pidiendo elegir proveedor (el selector ya existe en el form; pasa de opcional a condicionalmente obligatorio).

### 3. Reutilización de lógica: no duplicar el alta de stock

`createPurchase` (en `src/app/actions/purchases.ts`) hoy hace dos cosas en un solo flujo: inserta la compra + sus ítems, y (si `delivery_status === 'recibido'`) suma stock a las variantes.

Para los tres puntos de entrada nuevos (`/stock` positivo, `createProduct`, `updateProduct`) la necesidad es distinta:

- `/stock` (positivo) **sí** necesita que se sume stock → usa `createPurchase` tal cual existe hoy, sin tocarlo.
- `createProduct`/`updateProduct` **no** deben sumar stock de nuevo (el alta/edición de variante ya deja `stock_quantity` en su valor final) → se extrae de `createPurchase` un helper interno (`insertPurchaseRecord` o similar) que solo inserta la compra + `purchase_items` y devuelve el total, sin tocar `product_variants`. `createPurchase` pasa a: `insertPurchaseRecord(...)` + (si recibido) sumar stock. `createProduct`/`updateProduct` llaman solo a `insertPurchaseRecord(...)`.

Esto evita duplicar la lógica de inserción de compra sin arriesgar sumar stock dos veces.

### 4. Datos de la compra auto-generada

- `delivery_status`: siempre `'recibido'` (el stock ya está físicamente disponible en el momento de la carga).
- `payment_status`: `'pendiente'` por default. Si en realidad ya se pagó, se corrige después editando la compra desde `/compras`.
- `purchase_date`: fecha de hoy.
- `notes`: `null` (sin campo de notas en estos flujos rápidos, para no agregar fricción).

## Componentes afectados

- `src/app/actions/purchases.ts` — extraer `insertPurchaseRecord` de `createPurchase`.
- `src/app/actions/products.ts` — `createProduct`/`updateProduct` llaman a `insertPurchaseRecord` para los deltas positivos; validan proveedor obligatorio si hay stock en alza.
- `src/app/actions/stock.ts` o el propio componente — el flujo de cambio positivo pasa a llamar `createPurchase` en vez de `adjustStock`.
- `src/components/stock/adjustment-form.tsx` — UI condicional según signo (proveedor + costo vs. motivo), necesita recibir `supplierId`/`costPrice` del producto y la lista de proveedores.
- `src/app/(dashboard)/stock/page.tsx` — sumar `supplier_id`, `cost_price` a la query de variantes y pasar lista de proveedores hacia abajo (vía `StockBadgeButton`).
- `src/components/products/product-form.tsx` — validación: proveedor obligatorio si algún talle queda con stock por encima del valor previo (o > 0 en alta).

## Verificación

- Sin test runner de UI; Vitest solo para lógica pura. Si `insertPurchaseRecord` o el cálculo de deltas positivos se puede aislar como función pura (qué ítems entran a la compra dado stock viejo/nuevo), se testea con Vitest igual que `stock-delta.ts`.
- El resto (Supabase, formularios) se verifica con `npm run build` + prueba manual en el navegador: cargar stock desde `/stock` con y sin proveedor asignado, crear producto con stock inicial, editar producto subiendo y bajando distintos talles a la vez, y confirmar en `/compras` y en la ficha del proveedor que la compra quedó registrada con los ítems y costos correctos.
