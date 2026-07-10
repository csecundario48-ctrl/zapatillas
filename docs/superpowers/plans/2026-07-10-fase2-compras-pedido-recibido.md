# Fase 2 — Compras: flujo Pedido → Recibido — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que una compra pueda registrarse como "Pedido" (no suma stock) y luego marcarse "Recibida" (suma stock), con borrado que revierte stock e historial por proveedor.

**Architecture:** Se agrega una columna `delivery_status` a `purchases`. `createPurchase` condiciona el alta de stock a ese estado. Dos server actions nuevas (`receivePurchase`, `deletePurchase`) mueven el stock por variante. La lista de compras se vuelve interactiva (badge de entrega + botones). Una ficha de proveedor nueva (`/proveedores/[id]`) muestra su historial.

**Tech Stack:** Next.js App Router (versión con breaking changes), Supabase (RLS `auth_all`, migraciones a mano), TypeScript, Vitest (solo lógica pura), Tailwind.

## Global Constraints

- **Next.js con breaking changes:** antes de tocar patrones de App Router / Server Actions consultar `node_modules/next/dist/docs/` y respetar deprecaciones (regla de `AGENTS.md`).
- **Migraciones a mano** en Supabase SQL Editor (no hay CLI conectada). La 008 la aplica el usuario; el código no depende de que esté aplicada para compilar, pero sí para correr contra la base.
- **RLS activo:** `purchases` ya tiene RLS `auth_all`. No se crean tablas nuevas.
- **Idioma:** UI y errores en español rioplatense.
- **Estados de entrega:** exactamente `pedido` y `recibido`. NO existe recepción parcial ni estado "cancelado". El pedido siempre llega completo.
- **Default de la columna nueva:** `delivery_status` default `recibido` → las compras existentes quedan recibidas (ya sumaron stock).
- **Compras = solo mercadería.** Los gastos no-mercadería viven en Egresos (fuera de alcance).
- **Nunca stock negativo:** al restar stock (borrar compra recibida) se bloquea con aviso si dejaría una variante en negativo. El check `stock_quantity >= 0` de la base es la última barrera.
- **Convención de embeds Supabase:** tipar embeds anidados con `as unknown as X[]`.
- **Sin item-level edit:** editar cantidades de una compra existente queda FUERA de este plan (se corrige borrando y recargando). No agregar formularios de edición de compra.

---

### Task 1: Modelo — migración 008 + tipos + validación

Agrega `delivery_status` a la base, a los tipos y al schema de validación. La migración se ESCRIBE acá; APLICARLA es paso manual del usuario (checkpoint final).

**Files:**
- Create: `supabase/migrations/008_purchase_delivery_status.sql`
- Modify: `src/types/database.ts`
- Modify: `src/lib/validations/purchase.ts`

**Interfaces:**
- Produces: `DeliveryStatus = 'pedido' | 'recibido'`; `Purchase.delivery_status: DeliveryStatus`; `purchaseSchema` incluye `delivery_status`.

- [ ] **Step 1: Escribir la migración 008**

Create `supabase/migrations/008_purchase_delivery_status.sql`:
```sql
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
```

- [ ] **Step 2: Agregar el tipo `DeliveryStatus` y el campo a `Purchase`**

En `src/types/database.ts`:
- Junto a `export type PaymentStatus = ...` (línea ~5) agregar:
  ```ts
  export type DeliveryStatus = 'pedido' | 'recibido'
  ```
- En `export interface Purchase` (línea ~89), agregar el campo después de `payment_status`:
  ```ts
    delivery_status: DeliveryStatus
  ```

- [ ] **Step 3: Agregar `delivery_status` al schema de validación**

En `src/lib/validations/purchase.ts`, dentro de `purchaseSchema`, después de `payment_status`:
```ts
  delivery_status: z.enum(['pedido', 'recibido']),
```

- [ ] **Step 4: Verificar compilación de los archivos tocados**

Run: `npx tsc --noEmit 2>&1 | grep -E "database.ts|validations/purchase" | head`
Expected: sin líneas. (El proyecto entero puede no compilar hasta terminar la fase; cada task verifica solo lo suyo salvo que se indique `npm run build`.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/008_purchase_delivery_status.sql src/types/database.ts src/lib/validations/purchase.ts
git commit -m "feat(fase2): modelo delivery_status en compras (migracion 008 + tipos + validacion)"
```

---

### Task 2: Lógica pura de deltas de stock + tests

Función pura que agrega cantidades por variante, usada por las acciones de recibir/borrar. Es la única lógica con tests unitarios (Vitest).

**Files:**
- Create: `src/lib/utils/purchase-stock.ts`
- Create: `src/lib/utils/purchase-stock.test.ts`

**Interfaces:**
- Produces: `sumByVariant(items: { variant_id: string | null; quantity: number }[]): Map<string, number>` — suma cantidades por `variant_id`, ignorando ítems sin variante.

- [ ] **Step 1: Escribir el test que falla**

Create `src/lib/utils/purchase-stock.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { sumByVariant } from './purchase-stock'

describe('sumByVariant', () => {
  it('suma cantidades del mismo variant_id', () => {
    const m = sumByVariant([
      { variant_id: 'a', quantity: 2 },
      { variant_id: 'a', quantity: 3 },
      { variant_id: 'b', quantity: 1 },
    ])
    expect(m.get('a')).toBe(5)
    expect(m.get('b')).toBe(1)
  })

  it('ignora items sin variant_id', () => {
    const m = sumByVariant([
      { variant_id: null, quantity: 9 },
      { variant_id: 'a', quantity: 2 },
    ])
    expect(m.has('a')).toBe(true)
    expect(m.get('a')).toBe(2)
    expect(m.size).toBe(1)
  })

  it('devuelve mapa vacío con lista vacía', () => {
    expect(sumByVariant([]).size).toBe(0)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npx vitest run src/lib/utils/purchase-stock.test.ts`
Expected: FAIL — `sumByVariant` no existe / módulo no encontrado.

- [ ] **Step 3: Implementar el helper**

Create `src/lib/utils/purchase-stock.ts`:
```ts
/** Suma cantidades por variante. Ignora ítems sin variant_id (producto borrado). */
export function sumByVariant(
  items: { variant_id: string | null; quantity: number }[]
): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    if (!it.variant_id) continue
    m.set(it.variant_id, (m.get(it.variant_id) ?? 0) + it.quantity)
  }
  return m
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npx vitest run src/lib/utils/purchase-stock.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/purchase-stock.ts src/lib/utils/purchase-stock.test.ts
git commit -m "feat(fase2): helper puro sumByVariant + tests"
```

---

### Task 3: `createPurchase` por estado + selector en el formulario

La compra se crea con el estado elegido; solo suma stock si es `recibido`. El form suma un selector Pedido/Recibido.

**Files:**
- Modify: `src/app/actions/purchases.ts`
- Modify: `src/components/purchases/purchase-form.tsx`
- Modify: `src/app/(dashboard)/compras/nueva/page.tsx` (solo si hace falta pasar algo; ver Step 3)

**Interfaces:**
- Consumes: `sumByVariant` (Task 2), `DeliveryStatus` (Task 1).
- Produces: `CreatePurchaseInput` gana `delivery_status: DeliveryStatus`.

- [ ] **Step 1: Agregar `delivery_status` al input y condicionar el stock**

En `src/app/actions/purchases.ts`:
- Importar el tipo: cambiar la línea de import de tipos a
  ```ts
  import type { PaymentStatus, DeliveryStatus } from '@/types/database'
  ```
- En `interface CreatePurchaseInput`, agregar el campo después de `payment_status`:
  ```ts
    delivery_status: DeliveryStatus
  ```
- En el `insert` de `purchases` (objeto que hoy tiene `payment_status`), agregar:
  ```ts
      delivery_status: input.delivery_status,
  ```
- Envolver el bloque que suma stock (el `for (const [variantId, qty] of qtyById) { ... }`, líneas ~92-101) en una condición: solo sumar si es recibido.
  ```ts
  if (input.delivery_status === 'recibido') {
    for (const [variantId, qty] of qtyById) {
      const v = byId.get(variantId)!
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: v.stock_quantity + qty })
        .eq('id', variantId)
      if (stockErr) {
        return { error: `Compra registrada, pero falló actualizar el stock: ${stockErr.message}` }
      }
    }
  }
  ```
  (Cuando es `pedido` no se toca stock.)

- [ ] **Step 2: Agregar el selector Pedido/Recibido al formulario**

En `src/components/purchases/purchase-form.tsx`:
- Agregar un estado local para el estado de entrega, default `'recibido'`:
  ```tsx
  const [deliveryStatus, setDeliveryStatus] = useState<'pedido' | 'recibido'>('recibido')
  ```
  (Importar `useState` si no está ya.)
- Agregar un control de selección cerca del selector de estado de pago, con las clases del form (reutilizar la constante `sel` si existe, o el mismo patrón de `<select>` del estado de pago). Etiqueta "Entrega":
  ```tsx
  <div className="space-y-1.5">
    <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Entrega</Label>
    <select
      value={deliveryStatus}
      onChange={e => setDeliveryStatus(e.target.value as 'pedido' | 'recibido')}
      className={sel}
    >
      <option value="recibido" className="bg-card">Recibido (suma stock)</option>
      <option value="pedido" className="bg-card">Pedido (no suma stock)</option>
    </select>
  </div>
  ```
  (Si el form no define una constante `sel`, copiar las clases del `<select>` de estado de pago existente.)
- En el objeto que se pasa a `createPurchase` dentro de `handleSubmit`, agregar `delivery_status: deliveryStatus`.

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions/purchases|purchase-form|compras/nueva" | head`
Expected: sin líneas.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/purchases.ts src/components/purchases/purchase-form.tsx
git commit -m "feat(fase2): createPurchase suma stock solo si es recibido + selector en el form"
```

---

### Task 4: Acciones `receivePurchase` y `deletePurchase`

Server actions que mueven stock: recibir suma; borrar (si estaba recibida) resta, bloqueando si dejaría negativo.

**Files:**
- Modify: `src/app/actions/purchases.ts`

**Interfaces:**
- Consumes: `sumByVariant` (Task 2).
- Produces: `receivePurchase(purchaseId: string): Promise<{ error?: string }>`; `deletePurchase(purchaseId: string): Promise<{ error?: string }>`.

- [ ] **Step 1: Importar el helper**

En `src/app/actions/purchases.ts`, agregar al tope (con los otros imports):
```ts
import { sumByVariant } from '@/lib/utils/purchase-stock'
```

- [ ] **Step 2: Implementar `receivePurchase`**

Agregar al final de `src/app/actions/purchases.ts`:
```ts
/** Marca una compra 'pedido' como 'recibido' y suma el stock de sus items. */
export async function receivePurchase(purchaseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .select('id, delivery_status, purchase_items(variant_id, quantity)')
    .eq('id', purchaseId)
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'Compra no encontrada' }

  const row = purchase as unknown as {
    delivery_status: string
    purchase_items: { variant_id: string | null; quantity: number }[]
  }
  if (row.delivery_status === 'recibido') return { error: 'La compra ya está recibida' }

  const deltas = sumByVariant(row.purchase_items ?? [])
  if (deltas.size > 0) {
    const ids = [...deltas.keys()]
    const { data: variants, error: vErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', ids)
    if (vErr) return { error: vErr.message }
    const stockById = new Map((variants ?? []).map(v => [v.id, v.stock_quantity]))

    for (const [variantId, qty] of deltas) {
      const current = stockById.get(variantId) ?? 0
      const { error: sErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: current + qty })
        .eq('id', variantId)
      if (sErr) return { error: `Falló actualizar el stock: ${sErr.message}` }
    }
  }

  const { error: uErr } = await supabase
    .from('purchases')
    .update({ delivery_status: 'recibido' })
    .eq('id', purchaseId)
  if (uErr) return { error: `Stock sumado, pero falló marcar recibida: ${uErr.message}` }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 3: Implementar `deletePurchase`**

Agregar al final de `src/app/actions/purchases.ts`:
```ts
/**
 * Borra una compra. Si estaba 'recibido', resta de cada variante el stock que
 * había sumado; si dejaría alguna variante en negativo, bloquea con aviso.
 */
export async function deletePurchase(purchaseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .select('id, delivery_status, purchase_items(variant_id, quantity, size_label)')
    .eq('id', purchaseId)
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'Compra no encontrada' }

  const row = purchase as unknown as {
    delivery_status: string
    purchase_items: { variant_id: string | null; quantity: number; size_label: string | null }[]
  }

  if (row.delivery_status === 'recibido') {
    const deltas = sumByVariant(row.purchase_items ?? [])
    if (deltas.size > 0) {
      const ids = [...deltas.keys()]
      const { data: variants, error: vErr } = await supabase
        .from('product_variants')
        .select('id, size, stock_quantity')
        .in('id', ids)
      if (vErr) return { error: vErr.message }
      const byId = new Map((variants ?? []).map(v => [v.id, v]))

      // Chequear que ninguna quede negativa ANTES de tocar nada.
      for (const [variantId, qty] of deltas) {
        const current = byId.get(variantId)?.stock_quantity ?? 0
        if (current - qty < 0) {
          const size = byId.get(variantId)?.size ?? '?'
          return {
            error: `No se puede borrar: dejaría el talle ${size} en negativo (stock actual ${current}, se intentan restar ${qty}). Ajustá el stock antes de borrar.`,
          }
        }
      }
      // Aplicar la resta.
      for (const [variantId, qty] of deltas) {
        const current = byId.get(variantId)!.stock_quantity
        const { error: sErr } = await supabase
          .from('product_variants')
          .update({ stock_quantity: current - qty })
          .eq('id', variantId)
        if (sErr) return { error: `Falló actualizar el stock: ${sErr.message}` }
      }
    }
  }

  const { error: dErr } = await supabase.from('purchases').delete().eq('id', purchaseId)
  if (dErr) return { error: dErr.message }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions/purchases|purchase-stock" | head`
Expected: sin líneas.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/purchases.ts
git commit -m "feat(fase2): acciones receivePurchase y deletePurchase con movimiento de stock"
```

---

### Task 5: Lista de compras interactiva — badge de entrega + botones

La página de compras muestra el estado de entrega y permite "Marcar recibida" y borrar. La página sigue siendo Server Component; las acciones van en un client component por fila.

**Files:**
- Create: `src/components/purchases/purchase-row-actions.tsx`
- Modify: `src/app/(dashboard)/compras/page.tsx`

**Interfaces:**
- Consumes: `receivePurchase`, `deletePurchase` (Task 4); `ConfirmDelete` (existente, `src/components/common/confirm-delete.tsx`).

- [ ] **Step 1: Crear el client component de acciones de fila**

Create `src/components/purchases/purchase-row-actions.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { receivePurchase, deletePurchase } from '@/app/actions/purchases'
import { ConfirmDelete } from '@/components/common/confirm-delete'

interface PurchaseRowActionsProps {
  purchaseId: string
  deliveryStatus: 'pedido' | 'recibido'
}

export function PurchaseRowActions({ purchaseId, deliveryStatus }: PurchaseRowActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onReceive() {
    setLoading(true)
    const { error } = await receivePurchase(purchaseId)
    setLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Compra marcada como recibida — stock sumado')
    router.refresh()
  }

  async function onDelete() {
    const { error } = await deletePurchase(purchaseId)
    if (error) return { error }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {deliveryStatus === 'pedido' && (
        <button
          type="button"
          onClick={onReceive}
          disabled={loading}
          className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Marcar recibida'}
        </button>
      )}
      <ConfirmDelete
        onConfirm={onDelete}
        title="¿Borrar esta compra?"
        description="Si estaba recibida, se resta el stock que había sumado."
      />
    </div>
  )
}
```
NOTA para el implementador: antes de escribir esto, abrí `src/components/common/confirm-delete.tsx` y ajustá el uso de `ConfirmDelete` a su interfaz real (nombres de props `onConfirm`/`title`/`description` y el shape de retorno `{ error?: string }`). Seguí el patrón de `src/components/products/product-row-actions.tsx`, que ya usa `ConfirmDelete` de la misma forma.

- [ ] **Step 2: Mostrar estado de entrega y las acciones en la página**

En `src/app/(dashboard)/compras/page.tsx`:
- Importar el componente y agregar el tipo `delivery_status` a la data (ya viene por `select('*')`).
  ```tsx
  import { PurchaseRowActions } from '@/components/purchases/purchase-row-actions'
  ```
- Agregar una constante de estilos de entrega junto a `paymentStyle`:
  ```tsx
  const deliveryStyle: Record<string, string> = {
    recibido: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
    pedido: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  }
  ```
- Agregar dos `<th>` a la cabecera, después de "Pago": "Entrega" y una columna vacía para acciones (alineada a la derecha):
  ```tsx
  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Entrega</th>
  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Acciones</th>
  ```
  (Dejar la columna "Vencimiento" donde está, o moverla antes de "Entrega" — mantener el orden visual coherente: Fecha · Proveedor · Total · Pago · Vencimiento · Entrega · Acciones. Ajustar la cabecera para que tenga las mismas columnas que el cuerpo.)
- En el cuerpo, después de la celda de "Vencimiento", agregar:
  ```tsx
  <td className="px-4 py-3">
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${deliveryStyle[p.delivery_status] ?? ''}`}>
      {p.delivery_status}
    </span>
  </td>
  <td className="px-4 py-3">
    <PurchaseRowActions purchaseId={p.id} deliveryStatus={p.delivery_status} />
  </td>
  ```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "compras/page|purchase-row-actions" | head`
Expected: sin líneas.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/compras/page.tsx" src/components/purchases/purchase-row-actions.tsx
git commit -m "feat(fase2): lista de compras con estado de entrega, marcar recibida y borrar"
```

---

### Task 6: Ficha de proveedor con historial de compras

Nueva página de detalle `/proveedores/[id]` que muestra el proveedor y todas sus compras. La lista de proveedores linkea a cada ficha.

**Files:**
- Create: `src/app/(dashboard)/proveedores/[id]/page.tsx`
- Modify: `src/app/(dashboard)/proveedores/proveedores-client.tsx`

**Interfaces:**
- Consumes: tipos `Supplier`, `Purchase` (existentes); helpers `formatCurrency`, `formatDate` de `@/lib/utils/format`.

- [ ] **Step 1: Crear la página de detalle del proveedor**

Create `src/app/(dashboard)/proveedores/[id]/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Purchase, Supplier } from '@/types/database'

const paymentStyle: Record<string, string> = {
  pagado: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  pendiente: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  parcial: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}
const deliveryStyle: Record<string, string> = {
  recibido: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  pedido: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
}

export default async function ProveedorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: supplier }, { data: purchasesRaw }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).single(),
    supabase
      .from('purchases')
      .select('*')
      .eq('supplier_id', id)
      .order('purchase_date', { ascending: false }),
  ])

  if (!supplier) notFound()
  const s = supplier as Supplier
  const purchases = (purchasesRaw as Purchase[] | null) ?? []
  const totalComprado = purchases.reduce((sum, p) => sum + p.total_amount, 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/proveedores" className="text-xs text-indigo-400 hover:text-indigo-300">← Proveedores</Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{s.name}</h1>
        <p className="text-sm text-foreground/55 mt-0.5">
          {s.contact_name ? `${s.contact_name} · ` : ''}{s.phone ?? 'sin teléfono'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-4">
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{purchases.length}</p>
          <p className="text-xs text-foreground/55 mt-1">Compras</p>
        </div>
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-4">
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(totalComprado)}</p>
          <p className="text-xs text-foreground/55 mt-1">Total comprado</p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
        {purchases.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-background">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Total</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Pago</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-foreground/[0.06]">
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground/70">{formatDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground tabular-nums">{formatCurrency(p.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${paymentStyle[p.payment_status] ?? ''}`}>{p.payment_status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${deliveryStyle[p.delivery_status] ?? ''}`}>{p.delivery_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-foreground/45 text-sm">Este proveedor no tiene compras registradas.</p>
          </div>
        )}
      </div>
    </div>
  )
}
```
NOTA: confirmar la firma de `params` contra la versión de Next del proyecto (`node_modules/next/dist/docs/`). En esta versión los `params` de páginas son async (`Promise<...>`) y se hace `await params`; si la doc indica otra cosa, ajustarlo.

- [ ] **Step 2: Linkear cada proveedor a su ficha**

En `src/app/(dashboard)/proveedores/proveedores-client.tsx`, envolver el nombre del proveedor (o agregar un link) hacia `/proveedores/${s.id}`. Abrir el archivo, ubicar dónde se renderiza cada proveedor de la lista, y hacer el nombre un `Link`:
```tsx
import Link from 'next/link'
```
```tsx
<Link href={`/proveedores/${s.id}`} className="font-medium text-foreground hover:text-indigo-400 transition-colors">
  {s.name}
</Link>
```
(Adaptar a la estructura real de la fila; mantener el resto de la fila igual, incluidos los botones de editar/borrar si existen.)

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "proveedores" | head`
Expected: sin líneas.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(dashboard)/proveedores/[id]/page.tsx" "src/app/(dashboard)/proveedores/proveedores-client.tsx"
git commit -m "feat(fase2): ficha de proveedor con historial de compras"
```

---

### Task 7: Verificación final (build completo + checklist manual)

**Files:** ninguno (verificación).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript. Es el gate de tipos de toda la fase. Si falla, resolver antes de continuar.

- [ ] **Step 2: Tests unitarios**

Run: `npx vitest run`
Expected: todos verdes (incluye los de `sizes`, `product-groups` y el nuevo `purchase-stock`).

- [ ] **Step 3: Checkpoint manual del usuario — aplicar migración 008**

El usuario aplica `supabase/migrations/008_purchase_delivery_status.sql` en el SQL Editor de Supabase (con backup). Verificar después:
```sql
select delivery_status, count(*) from purchases group by delivery_status;
```
Expected: todas las compras existentes en `recibido`.

- [ ] **Step 4: Checklist e2e en el navegador** (con la migración aplicada)

1. Nueva compra como **Pedido** → NO cambia el stock del talle. Aparece en la lista con badge "pedido".
2. "Marcar recibida" en esa compra → el stock del talle sube por la cantidad; el badge pasa a "recibido".
3. Nueva compra como **Recibido** → el stock sube al instante.
4. Borrar una compra recibida → el stock baja por su cantidad. Si el stock ya se vendió y no alcanza, muestra el aviso de negativo y NO borra.
5. Ficha de proveedor (`/proveedores/[id]`) → muestra el historial con estados de pago y entrega.

---
