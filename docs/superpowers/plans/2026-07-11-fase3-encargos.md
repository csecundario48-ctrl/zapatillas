# Fase 3 — Encargos (venta con seña) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una venta pueda registrarse como "encargo" (seña cobrada, no mueve stock ni cuenta como ingreso) y luego completarse (entrega + pago del resto → venta normal) o cancelarse (la seña queda para el negocio).

**Architecture:** Un encargo es una fila de `sales` con `status='encargo'` y una columna nueva `deposit_amount`. El form de "Nueva venta" gana un toggle que activa el modo encargo (permite talles sin stock, pide la seña, no descuenta stock). Dos server actions nuevas (`completeEncargo`, `cancelEncargo`) mueven el estado. Una sección `/encargos` lista los pendientes. Finanzas suma la seña de los encargos cancelados.

**Tech Stack:** Next.js 16 App Router (Turbopack), Supabase (RLS, migraciones a mano), TypeScript, Vitest (solo lógica pura), Tailwind.

## Global Constraints

- **Next.js con breaking changes:** antes de tocar patrones de App Router / Server Actions consultar `node_modules/next/dist/docs/` y respetar deprecaciones (regla de `AGENTS.md`). Confirmado: params de página son async (`await params`).
- **Migraciones a mano** en Supabase SQL Editor (no hay CLI conectada). La 009 la aplica el usuario; el código no depende de que esté aplicada para compilar, pero sí para correr contra la base.
- **RLS activo:** `sales` ya tiene RLS. No se crean tablas nuevas.
- **Idioma:** UI y errores en español rioplatense.
- **Estados de venta:** `completada`, `cancelada`, `devolucion`, `encargo`. Un encargo pendiente es `encargo`; al completar → `completada`; al cancelar → `cancelada`.
- **Seña:** monto libre. `deposit_amount >= 0` y `<= total`. El resto = total − seña se calcula, no se guarda.
- **Un ticket es encargo o venta normal**, no se mezclan ítems con y sin stock.
- **Ingreso en Finanzas:** solo `completada` (total completo) + la seña (`deposit_amount`) de las `cancelada`. Los `encargo` pendientes NO cuentan.
- **Convención de embeds Supabase:** tipar embeds anidados con `as unknown as X[]`.
- **Nav real:** `src/components/layout/nav-config.ts` (el archivo `nav-items.ts` es un duplicado muerto; no tocarlo).

---

### Task 1: Modelo — migración 009 + tipos

Agrega el estado `encargo` y la columna `deposit_amount` a la base y a los tipos. La migración se ESCRIBE acá; APLICARLA es paso manual del usuario (checkpoint final).

**Files:**
- Create: `supabase/migrations/009_sales_encargo.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: `SaleStatus` incluye `'encargo'`; `Sale.deposit_amount: number`.

- [ ] **Step 1: Escribir la migración 009**

Create `supabase/migrations/009_sales_encargo.sql`:
```sql
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
```

- [ ] **Step 2: Agregar `'encargo'` a `SaleStatus` y `deposit_amount` a `Sale`**

En `src/types/database.ts`:
- Cambiar la línea `export type SaleStatus = 'completada' | 'cancelada' | 'devolucion'` por:
  ```ts
  export type SaleStatus = 'completada' | 'cancelada' | 'devolucion' | 'encargo'
  ```
- En `export interface Sale`, después de `total_amount: number` agregar:
  ```ts
    deposit_amount: number
  ```

- [ ] **Step 3: Verificar compilación de los archivos tocados**

Run: `npx tsc --noEmit 2>&1 | grep -E "database.ts" | head`
Expected: sin líneas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/009_sales_encargo.sql src/types/database.ts
git commit -m "feat(fase3): modelo encargo en ventas (migracion 009 + tipos)"
```

---

### Task 2: Lógica pura de seña/resto + tests

Funciones puras para el resto y la validación de la seña, usadas por el form y las acciones. Es la única lógica con tests unitarios (Vitest).

**Files:**
- Create: `src/lib/utils/deposit.ts`
- Create: `src/lib/utils/deposit.test.ts`

**Interfaces:**
- Produces:
  - `remainingAmount(total: number, deposit: number): number` — `total − deposit`, nunca negativo (clamp a 0).
  - `isValidDeposit(total: number, deposit: number): boolean` — `deposit >= 0 && deposit <= total`.

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/utils/deposit.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { remainingAmount, isValidDeposit } from './deposit'

describe('remainingAmount', () => {
  it('resta la seña del total', () => {
    expect(remainingAmount(80000, 10000)).toBe(70000)
  })

  it('nunca devuelve negativo', () => {
    expect(remainingAmount(50000, 60000)).toBe(0)
  })

  it('seña 0 devuelve el total', () => {
    expect(remainingAmount(50000, 0)).toBe(50000)
  })
})

describe('isValidDeposit', () => {
  it('acepta seña entre 0 y total', () => {
    expect(isValidDeposit(80000, 10000)).toBe(true)
    expect(isValidDeposit(80000, 0)).toBe(true)
    expect(isValidDeposit(80000, 80000)).toBe(true)
  })

  it('rechaza seña negativa', () => {
    expect(isValidDeposit(80000, -1)).toBe(false)
  })

  it('rechaza seña mayor al total', () => {
    expect(isValidDeposit(80000, 90000)).toBe(false)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/utils/deposit.test.ts`
Expected: FAIL — módulo no encontrado / funciones no existen.

- [ ] **Step 3: Implementar el helper**

Create `src/lib/utils/deposit.ts`:
```ts
/** Resto a pagar de un encargo: total menos la seña, nunca negativo. */
export function remainingAmount(total: number, deposit: number): number {
  return Math.max(0, total - deposit)
}

/** La seña es válida si es >= 0 y no supera el total. */
export function isValidDeposit(total: number, deposit: number): boolean {
  return deposit >= 0 && deposit <= total
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/utils/deposit.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/deposit.ts src/lib/utils/deposit.test.ts
git commit -m "feat(fase3): helpers puros remainingAmount + isValidDeposit + tests"
```

---

### Task 3: `createSale` acepta encargo + toggle en el formulario

La venta se crea como encargo o normal según un flag. En modo encargo no valida ni descuenta stock, guarda la seña y `status='encargo'`. El form suma un toggle y el campo seña, y en modo encargo permite talles sin stock.

**Files:**
- Modify: `src/app/actions/sales.ts`
- Modify: `src/app/(dashboard)/ventas/nueva/page.tsx`
- Modify: `src/components/sales/sale-form.tsx`

**Interfaces:**
- Consumes: `isValidDeposit` (Task 2).
- Produces: `CreateSaleInput` gana `is_encargo: boolean` y `deposit_amount: number`.

- [ ] **Step 1: Agregar `is_encargo`/`deposit_amount` al input y condicionar el stock**

En `src/app/actions/sales.ts`:
- Agregar el import del helper al tope (con los otros imports):
  ```ts
  import { isValidDeposit } from '@/lib/utils/deposit'
  ```
- En `interface CreateSaleInput`, después de `customer_id: string | null` agregar:
  ```ts
    is_encargo: boolean
    deposit_amount: number
  ```
- Dentro de `createSale`, DESPUÉS del bloque que calcula `total` (el `for` que suma `total += ...`) y ANTES del bloque que valida stock disponible (`for (const [variantId, qty] of qtyById)` que compara `qty > v.stock_quantity`), insertar la bifurcación de encargo. Reemplazar este bloque:
  ```ts
    for (const [variantId, qty] of qtyById) {
      const v = byId.get(variantId)!
      if (qty > v.stock_quantity) {
        return { error: `Stock insuficiente (disponible: ${v.stock_quantity}). Actualizá la página y reintentá.` }
      }
    }
  ```
  por:
  ```ts
    if (input.is_encargo) {
      if (!isValidDeposit(total, input.deposit_amount)) {
        return { error: 'La seña debe ser mayor o igual a 0 y no puede superar el total' }
      }
    } else {
      for (const [variantId, qty] of qtyById) {
        const v = byId.get(variantId)!
        if (qty > v.stock_quantity) {
          return { error: `Stock insuficiente (disponible: ${v.stock_quantity}). Actualizá la página y reintentá.` }
        }
      }
    }
  ```
- En el `insert` de `sales`, cambiar los campos `status` y agregar `deposit_amount`. Reemplazar:
  ```ts
      total_amount: total,
      status: 'completada',
      created_by: user.id,
  ```
  por:
  ```ts
      total_amount: total,
      deposit_amount: input.is_encargo ? input.deposit_amount : 0,
      status: input.is_encargo ? 'encargo' : 'completada',
      created_by: user.id,
  ```
- Envolver el bloque final que descuenta stock (el `for (const [variantId, qty] of qtyById)` con `stock_quantity: v.stock_quantity - qty`) en una condición para NO tocar stock si es encargo:
  ```ts
    if (!input.is_encargo) {
      for (const [variantId, qty] of qtyById) {
        const v = byId.get(variantId)!
        const { error: stockErr } = await supabase
          .from('product_variants')
          .update({ stock_quantity: v.stock_quantity - qty })
          .eq('id', variantId)
        if (stockErr) {
          return { error: `Venta registrada, pero falló actualizar el stock: ${stockErr.message}` }
        }
      }
    }
  ```
- Agregar `revalidatePath('/encargos')` junto a los otros `revalidatePath` del final de `createSale`.

- [ ] **Step 2: Pasar TODAS las variantes activas (incl. stock 0) al form**

En `src/app/(dashboard)/ventas/nueva/page.tsx`, en el `.filter(...)` que arma `variants`, quitar la condición de stock para que las de stock 0 lleguen al form (el form decide según el modo). Reemplazar:
```ts
    .filter(v => v.products?.active && v.stock_quantity > 0)
```
por:
```ts
    .filter(v => v.products?.active)
```

- [ ] **Step 3: Agregar el toggle de encargo, la seña y el filtro condicional al form**

En `src/components/sales/sale-form.tsx`:
- Importar el helper (con los otros imports):
  ```ts
  import { remainingAmount } from '@/lib/utils/deposit'
  ```
- Agregar estados locales, junto a los otros `useState`:
  ```ts
  const [isEncargo, setIsEncargo] = useState(false)
  const [deposit, setDeposit] = useState(0)
  ```
- Cambiar `filteredVariants` para que solo exija stock cuando NO es encargo. Reemplazar:
  ```ts
  const filteredVariants = variants.filter(
    v =>
      v.stock_quantity > 0 &&
      `${v.brand} ${v.model} ${v.color} ${v.size}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )
  ```
  por:
  ```ts
  const filteredVariants = variants.filter(
    v =>
      (isEncargo || v.stock_quantity > 0) &&
      `${v.brand} ${v.model} ${v.color} ${v.size}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )
  ```
- En `addItem`, el chequeo de stock al reincrementar cantidad no debe bloquear en modo encargo. Reemplazar:
  ```ts
    if (existing) {
      if (existing.quantity >= variant.stock_quantity) {
        setError(`Stock insuficiente: solo hay ${variant.stock_quantity} ud. de ${variant.brand} ${variant.model} T${variant.size}`)
        return
      }
      setItems(items.map(i =>
        i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
  ```
  por:
  ```ts
    if (existing) {
      if (!isEncargo && existing.quantity >= variant.stock_quantity) {
        setError(`Stock insuficiente: solo hay ${variant.stock_quantity} ud. de ${variant.brand} ${variant.model} T${variant.size}`)
        return
      }
      setItems(items.map(i =>
        i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
  ```
- En la celda de cantidad de la tabla de ítems, el `max` y el clamp usan `item.variant.stock_quantity`, lo que impediría cantidades en modo encargo (stock 0). Reemplazar el `<Input>` de cantidad:
  ```tsx
                    <Input
                      type="number"
                      min={1}
                      max={item.variant.stock_quantity}
                      value={item.quantity}
                      className="w-16"
                      onChange={e =>
                        setItems(items.map(i =>
                          i.variant.id === item.variant.id
                            ? { ...i, quantity: Math.min(Math.max(1, Number(e.target.value)), item.variant.stock_quantity) }
                            : i
                        ))
                      }
                    />
  ```
  por:
  ```tsx
                    <Input
                      type="number"
                      min={1}
                      max={isEncargo ? undefined : item.variant.stock_quantity}
                      value={item.quantity}
                      className="w-16"
                      onChange={e => {
                        const raw = Math.max(1, Number(e.target.value))
                        const qty = isEncargo ? raw : Math.min(raw, item.variant.stock_quantity)
                        setItems(items.map(i =>
                          i.variant.id === item.variant.id ? { ...i, quantity: qty } : i
                        ))
                      }}
                    />
  ```
- Agregar el toggle y el campo seña. Insertar, DESPUÉS del `<div>` de "Medio de pago" y ANTES del cierre del `grid` de meta (es decir, como último hijo del `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">`):
  ```tsx
        <div className="space-y-1.5 sm:col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isEncargo}
              onChange={e => { setIsEncargo(e.target.checked); if (!e.target.checked) setDeposit(0) }}
              className="accent-indigo-500 size-4"
            />
            <span className="text-sm text-foreground">Es encargo (seña por un producto sin stock)</span>
          </label>
        </div>
        {isEncargo && (
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Seña</Label>
            <Input
              type="number"
              min={0}
              value={deposit}
              onChange={e => setDeposit(Math.max(0, Number(e.target.value)))}
              placeholder="0"
            />
            <p className="text-[11px] text-foreground/55">Resto a pagar: {formatCurrency(remainingAmount(total, deposit))}</p>
          </div>
        )}
  ```
- En `handleSubmit`, pasar los campos nuevos a `createSale`. En el objeto que se pasa a `createSale`, después de `customer_id: customerId,` agregar:
  ```ts
      is_encargo: isEncargo,
      deposit_amount: isEncargo ? deposit : 0,
  ```
- En el `toast.success` de `handleSubmit`, diferenciar el mensaje. Reemplazar:
  ```ts
    toast.success(`Venta registrada — ${formatCurrency(total)}`)
    router.push('/ventas')
  ```
  por:
  ```ts
    toast.success(isEncargo ? `Encargo registrado — seña ${formatCurrency(deposit)}` : `Venta registrada — ${formatCurrency(total)}`)
    router.push(isEncargo ? '/encargos' : '/ventas')
  ```
- El botón de submit muestra "Confirmar venta"; en modo encargo conviene otro texto. Reemplazar el contenido del `<Button>`:
  ```tsx
        {loading ? 'Registrando venta...' : `Confirmar venta — ${formatCurrency(total)}`}
  ```
  por:
  ```tsx
        {loading
          ? (isEncargo ? 'Registrando encargo...' : 'Registrando venta...')
          : (isEncargo ? `Confirmar encargo — seña ${formatCurrency(deposit)}` : `Confirmar venta — ${formatCurrency(total)}`)}
  ```

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions/sales|sale-form|ventas/nueva" | head`
Expected: sin líneas.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/sales.ts "src/app/(dashboard)/ventas/nueva/page.tsx" src/components/sales/sale-form.tsx
git commit -m "feat(fase3): createSale soporta encargo + toggle y seña en el form de venta"
```

---

### Task 4: Acciones `completeEncargo` y `cancelEncargo`

Server actions que mueven el estado del encargo: completar descuenta stock y pasa a `completada`; cancelar pasa a `cancelada` reteniendo la seña.

**Files:**
- Modify: `src/app/actions/sales.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `completeEncargo(saleId: string, paymentMethod: PaymentMethod): Promise<{ error?: string }>`; `cancelEncargo(saleId: string): Promise<{ error?: string }>`.

- [ ] **Step 1: Asegurar el import de `PaymentMethod`**

En `src/app/actions/sales.ts`, el import de tipos ya trae `PaymentMethod` (`import type { PaymentMethod, SaleChannel } from '@/types/database'`). Si no estuviera, agregarlo. No dupliques el import.

- [ ] **Step 2: Implementar `completeEncargo`**

Agregar al final de `src/app/actions/sales.ts`:
```ts
/**
 * Completa un encargo: descuenta el stock de sus items (bloquea si no alcanza),
 * lo pasa a 'completada' y registra la forma de pago del resto. El update
 * condicionado por status evita completar dos veces.
 */
export async function completeEncargo(
  saleId: string,
  paymentMethod: PaymentMethod
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: sale, error: sErr } = await supabase
    .from('sales')
    .select('id, status, sale_items(variant_id, quantity, size_label)')
    .eq('id', saleId)
    .single()
  if (sErr || !sale) return { error: sErr?.message ?? 'Encargo no encontrado' }
  if (sale.status !== 'encargo') return { error: 'Este encargo ya fue completado o cancelado' }

  const qtyById = new Map<string, number>()
  const sizeById = new Map<string, string | null>()
  for (const it of (sale.sale_items ?? []) as { variant_id: string | null; quantity: number; size_label: string | null }[]) {
    if (!it.variant_id) continue
    qtyById.set(it.variant_id, (qtyById.get(it.variant_id) ?? 0) + it.quantity)
    sizeById.set(it.variant_id, it.size_label)
  }

  if (qtyById.size > 0) {
    const ids = [...qtyById.keys()]
    const { data: variants, error: vErr } = await supabase
      .from('product_variants')
      .select('id, size, stock_quantity')
      .in('id', ids)
    if (vErr) return { error: vErr.message }
    const byId = new Map((variants ?? []).map(v => [v.id, v]))

    // Chequear stock suficiente ANTES de tocar nada.
    for (const [variantId, qty] of qtyById) {
      const current = byId.get(variantId)?.stock_quantity ?? 0
      if (current < qty) {
        const size = byId.get(variantId)?.size ?? sizeById.get(variantId) ?? '?'
        return {
          error: `No hay stock para completar: talle ${size} tiene ${current} y se necesitan ${qty}. Registrá la compra/recepción antes de completar.`,
        }
      }
    }
    // Descontar.
    for (const [variantId, qty] of qtyById) {
      const current = byId.get(variantId)!.stock_quantity
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: current - qty })
        .eq('id', variantId)
      if (stockErr) return { error: `Falló actualizar el stock: ${stockErr.message}` }
    }
  }

  const { data: updated, error: uErr } = await supabase
    .from('sales')
    .update({ status: 'completada', payment_method: paymentMethod })
    .eq('id', saleId)
    .eq('status', 'encargo')
    .select('id')
  if (uErr) return { error: `Stock descontado, pero falló completar el encargo: ${uErr.message}` }
  if (!updated?.length) return { error: 'Este encargo ya fue completado o cancelado' }

  revalidatePath('/encargos')
  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 3: Implementar `cancelEncargo`**

Agregar al final de `src/app/actions/sales.ts`:
```ts
/**
 * Cancela un encargo: pasa a 'cancelada' sin tocar stock. La seña cobrada queda
 * para el negocio (Finanzas la cuenta como ingreso). Update condicionado por status.
 */
export async function cancelEncargo(saleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: updated, error: uErr } = await supabase
    .from('sales')
    .update({ status: 'cancelada' })
    .eq('id', saleId)
    .eq('status', 'encargo')
    .select('id')
  if (uErr) return { error: uErr.message }
  if (!updated?.length) return { error: 'Este encargo ya fue completado o cancelado' }

  revalidatePath('/encargos')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions/sales" | head`
Expected: sin líneas.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/sales.ts
git commit -m "feat(fase3): acciones completeEncargo y cancelEncargo"
```

---

### Task 5: Sección `/encargos` + acciones de fila + nav + excluir de Ventas

La página `/encargos` lista los pendientes con acciones para completar (eligiendo forma de pago) y cancelar. Se agrega al menú. La página de Ventas deja de mostrar los encargos pendientes.

**Files:**
- Create: `src/app/(dashboard)/encargos/page.tsx`
- Create: `src/components/encargos/encargo-row-actions.tsx`
- Modify: `src/components/layout/nav-config.ts`
- Modify: `src/app/(dashboard)/ventas/page.tsx`

**Interfaces:**
- Consumes: `completeEncargo`, `cancelEncargo` (Task 4); `remainingAmount` (Task 2); helpers `formatCurrency`, `formatDate` de `@/lib/utils/format`.

- [ ] **Step 1: Crear el client component de acciones de fila**

Create `src/components/encargos/encargo-row-actions.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { completeEncargo, cancelEncargo } from '@/app/actions/sales'
import type { PaymentMethod } from '@/types/database'

export function EncargoRowActions({ saleId }: { saleId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('efectivo')

  async function onComplete() {
    setLoading(true)
    const { error } = await completeEncargo(saleId, method)
    setLoading(false)
    setCompleting(false)
    if (error) { toast.error(error); return }
    toast.success('Encargo completado — stock descontado')
    router.refresh()
  }

  async function onCancel() {
    setLoading(true)
    const { error } = await cancelEncargo(saleId)
    setLoading(false)
    setCancelling(false)
    if (error) { toast.error(error); return }
    toast.success('Encargo cancelado — la seña queda registrada')
    router.refresh()
  }

  if (completing) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <select
          value={method}
          onChange={e => setMethod(e.target.value as PaymentMethod)}
          className="bg-card border border-foreground/10 text-foreground rounded-md px-2 py-1 text-xs focus:outline-none focus:border-indigo-500/50"
        >
          <option value="efectivo" className="bg-card">Efectivo</option>
          <option value="transferencia" className="bg-card">Transferencia</option>
          <option value="tarjeta" className="bg-card">Tarjeta</option>
          <option value="mercadopago" className="bg-card">MercadoPago</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={onComplete}
          className="px-2 py-1 rounded-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Confirmar'}
        </button>
        <button type="button" onClick={() => setCompleting(false)} className="px-2 py-1 rounded-md text-[11px] text-foreground/60 hover:text-foreground transition-colors">Volver</button>
      </div>
    )
  }

  if (cancelling) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="px-2 py-1 rounded-md text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Cancelar encargo'}
        </button>
        <button type="button" onClick={() => setCancelling(false)} className="px-2 py-1 rounded-md text-[11px] text-foreground/60 hover:text-foreground transition-colors">Volver</button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setCompleting(true)}
        className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors"
      >
        Completar entrega
      </button>
      <button
        type="button"
        onClick={() => setCancelling(true)}
        className="px-2.5 py-1 rounded-md text-foreground/55 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors"
      >
        Cancelar
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Crear la página `/encargos`**

Create `src/app/(dashboard)/encargos/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { remainingAmount } from '@/lib/utils/deposit'
import { EncargoRowActions } from '@/components/encargos/encargo-row-actions'

type EncargoRow = {
  id: string
  sale_date: string
  total_amount: number
  deposit_amount: number
  customers: { name: string } | null
  sale_items: { product_label: string | null; size_label: string | null; quantity: number }[]
}

export default async function EncargosPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sales')
    .select('id, sale_date, total_amount, deposit_amount, customers(name), sale_items(product_label, size_label, quantity)')
    .eq('status', 'encargo')
    .order('sale_date', { ascending: false })

  const encargos = (data as unknown as EncargoRow[] | null) ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Encargos</h1>
        <p className="text-sm text-foreground/55 mt-0.5">{encargos.length} pendientes de entrega</p>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
        {encargos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-background">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Producto</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Seña</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Resto</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {encargos.map(e => (
                  <tr key={e.id} className="border-b border-foreground/[0.06]">
                    <td className="px-4 py-3 font-mono text-[12px] text-foreground/70">{formatDate(e.sale_date)}</td>
                    <td className="px-4 py-3 text-foreground/85">{e.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {(e.sale_items ?? []).map((it, i) => (
                        <div key={i} className="text-[12px]">
                          {it.product_label ?? 'Producto'}{it.size_label ? ` T${it.size_label}` : ''}
                          <span className="text-foreground/45"> ×{it.quantity}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground tabular-nums">{formatCurrency(e.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(e.deposit_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(remainingAmount(e.total_amount, e.deposit_amount))}</td>
                    <td className="px-4 py-3">
                      <EncargoRowActions saleId={e.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-foreground/45 text-sm">No hay encargos pendientes.</p>
            <Link href="/ventas/nueva" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Registrar un encargo desde Nueva venta →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Agregar "Encargos" al menú**

En `src/components/layout/nav-config.ts`:
- Agregar `ClipboardList` a la lista de imports de `lucide-react` (junto a los otros iconos).
- En el grupo `'Operaciones'`, agregar el item después de `{ href: '/ventas', label: 'Ventas', icon: ShoppingCart }`:
  ```ts
      { href: '/encargos', label: 'Encargos', icon: ClipboardList },
  ```

- [ ] **Step 4: Excluir los encargos pendientes del historial de Ventas**

En `src/app/(dashboard)/ventas/page.tsx`, en el query de `sales`, agregar el filtro para no traer los `encargo`. Reemplazar:
```ts
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(100)
```
por:
```ts
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .neq('status', 'encargo')
    .order('created_at', { ascending: false })
    .limit(100)
```

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "encargos|nav-config|ventas/page" | head`
Expected: sin líneas.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/encargos/page.tsx" src/components/encargos/encargo-row-actions.tsx src/components/layout/nav-config.ts "src/app/(dashboard)/ventas/page.tsx"
git commit -m "feat(fase3): seccion /encargos con completar/cancelar, nav y exclusion de Ventas"
```

---

### Task 6: Finanzas cuenta la seña de los encargos cancelados

La seña retenida de un encargo cancelado debe contar como ingreso.

**Files:**
- Modify: `src/app/(dashboard)/finanzas/page.tsx`

**Interfaces:**
- Consumes: nada nuevo.

- [ ] **Step 1: Traer los encargos cancelados y sumar su seña al ingreso**

En `src/app/(dashboard)/finanzas/page.tsx`:
- En el `Promise.all`, agregar una consulta que traiga las ventas `cancelada` con seña. Reemplazar el arreglo destructurado:
  ```ts
  const [{ data: sales }, { data: expenses }, { data: pendingPurchases }] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_date, sale_items(quantity, unit_cost)')
      .eq('status', 'completada'),
    supabase.from('expenses').select('amount, expense_date, category'),
    supabase.from('purchases').select('total_amount').neq('payment_status', 'pagado'),
  ])
  ```
  por:
  ```ts
  const [{ data: sales }, { data: cancelledDeposits }, { data: expenses }, { data: pendingPurchases }] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_date, sale_items(quantity, unit_cost)')
      .eq('status', 'completada'),
    supabase
      .from('sales')
      .select('deposit_amount, sale_date')
      .eq('status', 'cancelada')
      .gt('deposit_amount', 0),
    supabase.from('expenses').select('amount, expense_date, category'),
    supabase.from('purchases').select('total_amount').neq('payment_status', 'pagado'),
  ])
  ```
- Sumar las señas al `totalIncome` y al `monthIncome`. Reemplazar:
  ```ts
  const totalIncome = sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const monthIncome = sales?.filter(s => s.sale_date >= monthStart).reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  ```
  por:
  ```ts
  const depositIncome = cancelledDeposits?.reduce((s, d) => s + d.deposit_amount, 0) ?? 0
  const monthDepositIncome = cancelledDeposits?.filter(d => d.sale_date >= monthStart).reduce((s, d) => s + d.deposit_amount, 0) ?? 0
  const totalIncome = (sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0) + depositIncome
  const monthIncome = (sales?.filter(s => s.sale_date >= monthStart).reduce((s, sale) => s + sale.total_amount, 0) ?? 0) + monthDepositIncome
  ```
- Sumar las señas al cashflow por mes. DESPUÉS del `for (const s of sales ?? []) { ... }` que suma `m.ingresos += s.total_amount`, agregar:
  ```ts
  for (const d of cancelledDeposits ?? []) {
    const m = cashflowByKey.get(d.sale_date.slice(0, 7))
    if (m) m.ingresos += d.deposit_amount
  }
  ```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "finanzas" | head`
Expected: sin líneas.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(dashboard)/finanzas/page.tsx"
git commit -m "feat(fase3): Finanzas cuenta la seña retenida de encargos cancelados"
```

---

### Task 7: Verificación final (build completo + tests + checkpoints)

**Files:** ninguno (verificación).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript. Es el gate de tipos de toda la fase.

- [ ] **Step 2: Tests unitarios**

Run: `npx vitest run`
Expected: todos verdes (incluye `sizes`, `product-groups`, `purchase-stock` y el nuevo `deposit`).

- [ ] **Step 3: Checkpoint manual del usuario — aplicar migración 009**

El usuario aplica `supabase/migrations/009_sales_encargo.sql` en el SQL Editor de Supabase (con backup). Verificar después:
```sql
select status, count(*) from sales group by status;
```
Expected: sin error; los estados existentes intactos, la columna `deposit_amount` disponible.

- [ ] **Step 4: Checklist e2e en el navegador** (con la migración aplicada)

1. Nueva venta con toggle **Es encargo** ON, elegir un talle con **stock 0**, poner una seña → se guarda; NO cambia stock; NO aparece en Ventas; SÍ aparece en `/encargos` con seña y resto.
2. En `/encargos`, **Completar entrega** eligiendo forma de pago → descuenta stock del talle, desaparece de Encargos, aparece en Ventas como `completada`, y el total cuenta en Finanzas. Si el talle no tiene stock, muestra aviso y NO completa.
3. Nuevo encargo y **Cancelar** → desaparece de Encargos; el stock queda intacto; la seña cuenta como ingreso en Finanzas.

---
