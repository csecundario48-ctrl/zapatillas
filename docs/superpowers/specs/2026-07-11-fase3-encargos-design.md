# Fase 3 — Encargos (venta con seña) — Design

**Fecha:** 2026-07-11
**Estado:** Aprobado por el usuario. Pendiente de plan de implementación.

## Contexto

Del rediseño funcional (`2026-07-09-rediseno-funcional-design.md`, módulo Encargos): un encargo es una venta especial donde el cliente paga una seña por un producto que no está en stock. No es una entidad separada de Ventas a nivel de historial: es un **estado** dentro del flujo de venta. Al completarse pasa a formar parte del historial de ventas normal.

Decisiones tomadas en el brainstorming (2026-07-11):
- **Qué se encarga:** un producto+talle que **ya existe en el catálogo** pero está con stock 0. El precio sale del producto (precio de lista), como una venta normal.
- **Seña:** monto libre ingresado a mano. El resto (total − seña) se calcula, no se guarda.
- **Cancelación:** si el cliente nunca vuelve, la seña **queda para el negocio** (cuenta como ingreso). El encargo queda como cancelado.
- **Alta:** con un toggle "Es encargo (seña)" en el formulario de "Nueva venta". Los pendientes se ven en una sección propia `/encargos`.
- **Forma de pago:** una sola por encargo (se registra al crear, con la seña; al completar se registra la forma de pago del resto, que pasa a ser la forma de pago final de la venta). No se separa seña vs. resto en métodos distintos (YAGNI).

## Modelo de datos (migración 009)

Un encargo **es una fila de `sales`** con un estado propio. No se crea tabla nueva.

- Nuevo valor de `status` (tipo `SaleStatus`): **`encargo`**.
- Nueva columna en `sales`: **`deposit_amount numeric not null default 0`** (la seña).

`total_amount` = total de lista de los ítems (igual que cualquier venta). El **resto = total_amount − deposit_amount** se calcula en la UI.

Estados de una venta que nació como encargo:

| status | Significado | Stock | ¿Ingreso en Finanzas? |
|--------|-------------|-------|------------------------|
| `encargo` | Pendiente de entrega, seña cobrada | No se toca | No |
| `completada` | Entregado, cliente pagó el resto | Se descuenta (como venta normal) | Sí — total completo |
| `cancelada` | Cliente no volvió | No se toca | Sí — solo la seña (`deposit_amount`) |

Migración `supabase/migrations/009_sales_encargo.sql`:

```sql
begin;

alter table sales
  add column deposit_amount numeric not null default 0
  check (deposit_amount >= 0);

alter table sales
  drop constraint if exists sales_status_check;

alter table sales
  add constraint sales_status_check
  check (status in ('completada', 'cancelada', 'devolucion', 'encargo'));

commit;
```

> Nota: el nombre real del check de `status` puede variar. La migración se ESCRIBE acá; el usuario la aplica a mano en el SQL Editor de Supabase (con backup). Si el check tiene otro nombre, se ajusta antes de aplicar.

## Lógica pura (con tests)

`src/lib/utils/deposit.ts`:
- `remainingAmount(total: number, deposit: number): number` — devuelve `total − deposit`, nunca negativo (clamp a 0).
- `isValidDeposit(total: number, deposit: number): boolean` — `deposit >= 0 && deposit <= total`.

Tests unitarios (Vitest) para ambas.

## Alta — toggle en "Nueva venta"

En `src/components/sales/sale-form.tsx` (o donde viva el form de venta):
- Un switch/checkbox **"Es encargo (seña)"**, default apagado.
- Con el toggle **apagado**: comportamiento actual sin cambios (valida stock, descuenta).
- Con el toggle **encendido**:
  - Se permite agregar variantes con `stock_quantity === 0` (hoy quizá se filtran o se bloquean): se saltea la validación de stock.
  - Aparece el campo **Seña** (monto a mano) + la forma de pago.
  - Se muestra el **resto** calculado (total − seña) en vivo.
  - Al enviar, se llama a `createSale` con `is_encargo: true` y `deposit_amount`.

El toggle aplica a **toda** la venta: un ticket es "encargo" o "venta normal", no se mezclan ítems.

## Server actions

En `src/app/actions/sales.ts`:

- `createSale` gana dos campos de entrada: `is_encargo: boolean` y `deposit_amount: number`.
  - Si `is_encargo`:
    - Valida `isValidDeposit(total, deposit_amount)`.
    - **No** valida stock disponible y **no** descuenta stock.
    - Inserta la venta con `status='encargo'`, `deposit_amount`.
  - Si no: comportamiento actual (status `completada`, descuenta stock, `deposit_amount=0`).
- `completeEncargo(saleId, paymentMethod)`:
  - Solo si la venta está en `encargo`.
  - Descuenta stock de cada ítem (bloquea con aviso si el stock no alcanza, igual que `createSale`).
  - Pasa a `status='completada'` y actualiza `payment_method` al del resto.
  - Update condicionado por `status='encargo'` para no completar dos veces.
  - `revalidatePath` de `/encargos`, `/ventas`, `/stock`, `/finanzas`, `/`.
- `cancelEncargo(saleId)`:
  - Solo si la venta está en `encargo`.
  - Pasa a `status='cancelada'` (no toca stock; la seña queda). Update condicionado.
  - `revalidatePath` de `/encargos`, `/finanzas`, `/`.

## Sección `/encargos`

`src/app/(dashboard)/encargos/page.tsx` (Server Component): lista las ventas con `status='encargo'`, con cliente, ítems (label+talle), total, seña, resto y fecha. Vacío → mensaje.

`src/components/encargos/encargo-row-actions.tsx` (Client Component) por fila:
- **Completar entrega**: abre un mini-selector de forma de pago del resto y llama a `completeEncargo`. Toast de éxito/error, `router.refresh()`.
- **Cancelar**: `ConfirmDelete`-style (o botón con confirmación) → `cancelEncargo`.

Navegación: agregar "Encargos" al menú (`nav-items` / `nav-config`).

## Integración con Finanzas

En `src/app/(dashboard)/finanzas/page.tsx`:
- Los `encargo` ya quedan excluidos del ingreso (solo se cuentan `completada`). Sin cambio.
- Los `completada` cuentan completo. Sin cambio.
- **Agregar**: sumar `deposit_amount` de las ventas `cancelada` al ingreso (seña retenida), usando `sale_date` como fecha del movimiento. No suma COGS (el COGS solo se calcula sobre `completada`). Esto se refleja en `totalIncome`, `monthIncome` y el cashflow por mes.

## Ventas (historial)

La página de Ventas debe seguir mostrando el historial normal. Verificar que **no** liste los `encargo` pendientes como ventas comunes (se manejan en `/encargos`). Si hoy hace `select` sin filtrar por status, se agrega `.neq('status', 'encargo')` o el filtro equivalente, manteniendo visibles `completada`/`devolucion`/`cancelada` según ya se muestren.

## Fuera de alcance

- Seña y resto con formas de pago distintas (una sola por encargo).
- Encargar productos que no existen en el catálogo (texto libre).
- Mezclar ítems con y sin stock en un mismo ticket.
- Historial de pagos parciales / múltiples señas.
- Reembolso automático de seña al cancelar (la seña queda para el negocio).

## Testing / verificación

- Unit: `remainingAmount`, `isValidDeposit`.
- Build completo (`npm run build`) como gate de tipos.
- Checkpoint manual: aplicar migración 009 en Supabase.
- E2e manual: crear encargo (no mueve stock, no cuenta ingreso) → completar (descuenta stock, cuenta ingreso) → crear otro y cancelar (seña cuenta como ingreso, stock intacto).
