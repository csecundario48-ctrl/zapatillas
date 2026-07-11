# Fase 2 — Compras: flujo Pedido → Recibido

Diseño de la Fase 2 del rediseño funcional. Depende de la Fase 1 (modelo producto/variante, ya implementada y desplegada). Ver spec global: `2026-07-09-rediseno-funcional-design.md` (módulo Compras).

## Objetivo

Las Compras dejan de sumar stock al instante. Se introduce un **estado de entrega** que separa "le pedí mercadería al proveedor" de "la mercadería llegó y está en el local":

- **Pedido**: la compra está registrada pero la mercadería no llegó. **No suma stock.**
- **Recibido**: la mercadería llegó. **Suma stock** a las variantes correspondientes.

## Alcance

Compras = **mercadería para revender** (calzado). Los gastos que no son mercadería (packaging, servicios, alquiler, delivery, sueldos, etc.) **no** son parte de este módulo: ya viven en **Egresos** (`/egresos`), no suman stock y no pasan por proveedor de mercadería ni por el flujo Pedido→Recibido.

**Fuera de alcance de esta fase** (van en fases siguientes):
- Relación con Caja (el pago de una compra resta del saldo de caja) → Fase 4.
- Encargos que se completan cuando llega la compra → Fase 3.
- Recepción parcial o estado "cancelado" → explícitamente NO existen (el pedido siempre llega completo; ver spec global).

## Estado actual (punto de partida)

- Tabla `purchases`: ya tiene `payment_status` (`pagado`/`parcial`/`pendiente`) y `payment_due_date`. **No** tiene estado de entrega.
- `purchase_items`: tras la migración 007 opera por `variant_id` + snapshots (`product_label`, `size_label`, `unit_cost`).
- `createPurchase` (`src/app/actions/purchases.ts`): hoy **suma stock siempre** al crear (`stock_quantity + qty` por variante).
- El form de compra (`purchase-form.tsx`) selecciona variantes (talles). No tiene selector de estado de entrega.

## Decisiones de diseño

### 1. Dato nuevo: `delivery_status`

Migración `008`: agregar a `purchases` la columna
`delivery_status text not null default 'recibido' check (delivery_status in ('pedido','recibido'))`.

El default `recibido` hace que **todas las compras existentes queden como recibidas** (ya sumaron stock en su momento), preservando la coherencia del stock actual.

### 2. Crear una compra: elegir Pedido o Recibido

El form de nueva compra suma un selector **Pedido / Recibido**:
- **Recibido** → `createPurchase` suma el stock al instante (comportamiento actual).
- **Pedido** → `createPurchase` registra la compra y sus ítems, pero **no toca el stock**.

### 3. Marcar como recibida

En la lista de compras, cada compra en estado **Pedido** muestra una acción **"Marcar recibida"**. Al confirmarla:
- La compra pasa a `recibido`.
- Se suma el stock de cada ítem a su variante (misma lógica que una compra creada como recibida).

Una compra ya `recibido` no muestra esa acción.

### 4. Editar / borrar con stock siempre consistente

Regla transversal del sistema: todo registro se puede editar/borrar y el stock nunca queda desincronizado. Para compras:

- **Editar cantidades de una compra `recibido`** → ajustar el stock de cada variante por la **diferencia** (nueva cant. − vieja cant.).
- **Editar una compra `pedido`** → no toca stock (todavía no sumó).
- **Borrar una compra `recibido`** → **restar** de cada variante el stock que esa compra había sumado.
- **Borrar una compra `pedido`** → no toca stock.

**Corrección de errores** (ej. marcaste recibida por equivocación): se resuelve editando o borrando la compra; **no** hay un botón dedicado de "deshacer recepción" (revertir `recibido`→`pedido`). Mantiene el flujo simple.

**Stock insuficiente al restar**: si restar stock (por borrado o edición a la baja de una compra recibida cuyo stock ya se vendió) dejaría una variante en negativo, la operación se **bloquea con un aviso claro** ("No se puede: implicaría dejar el talle X en negativo (stock actual N, se intentan restar M)"), igual que `createSale` bloquea una venta sin stock. Nunca se deja el stock en negativo ni se pierde silenciosamente. El check `stock_quantity >= 0` de la base es la última barrera a nivel datos.

### 5. Historial por proveedor

En la ficha del proveedor, listar todas sus compras a lo largo del tiempo, mostrando fecha, total, **estado de entrega** y **estado de pago**. Es una vista de lectura sobre `purchases` filtrada por `supplier_id`.

## Componentes afectados (anticipado, se detalla en el plan)

- `supabase/migrations/008_purchase_delivery_status.sql` — nueva columna + backfill implícito por default.
- `src/types/database.ts` — `Purchase.delivery_status`, tipo `DeliveryStatus`.
- `src/lib/validations/purchase.ts` — `delivery_status` en el schema.
- `src/app/actions/purchases.ts` — `createPurchase` condiciona el alta de stock al estado; nueva acción `receivePurchase(id)`; ajustes en editar/borrar para consistencia de stock.
- `src/components/purchases/purchase-form.tsx` — selector Pedido/Recibido.
- Lista de compras — badge de estado de entrega + acción "Marcar recibida".
- Ficha de proveedor — historial de compras.

## Verificación

Proyecto sin test runner salvo Vitest para lógica pura. La lógica de cálculo de deltas de stock (recibir, editar, borrar) debería aislarse en funciones puras testeables con Vitest. Lo que toca Supabase/UI se verifica con `npm run build` + prueba en el navegador contra la base real. La migración 008 se aplica a mano en Supabase (como la 007).
