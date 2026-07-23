# Compra automática al cargar stock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cuando se suma stock a un producto (desde `/stock` o desde el catálogo), se registra automáticamente una compra al proveedor en vez de requerir cargarla por separado.

**Architecture:** Se extrae de `createPurchase` un helper `insertPurchaseRecord` que solo inserta la compra + sus ítems (sin tocar stock). `/stock` (cambio positivo) sigue usando `createPurchase` completo (necesita sumar stock). `products.ts` (`createProduct`/`updateProduct`) usa `insertPurchaseRecord` directamente porque el alta/edición de variante ya deja el stock en su valor final. Sin migraciones nuevas.

**Tech Stack:** Next.js server actions, Supabase (Postgres + supabase-js), React Hook Form + Zod, Vitest para lógica pura.

## Global Constraints

- Sin migraciones nuevas — `purchases`/`purchase_items` ya soportan todo.
- Movimientos negativos de stock (rotura, pérdida, devolución, corrección a la baja) NO generan compra — siguen como `stock_adjustments`, sin cambios.
- Compra auto-generada: `delivery_status: 'recibido'`, `payment_status: 'pendiente'`, `notes: null`, fecha = hoy.
- Si hay stock en alza y el producto no tiene proveedor asignado, se bloquea con un error pidiendo elegir uno (tanto en cliente como en el server action, defensa en profundidad).
- Spec completa: `docs/superpowers/specs/2026-07-23-compra-automatica-stock-design.md`.

---

### Task 1: `product-groups.ts` — pasar `supplier_id`/`cost_price` por producto

**Files:**
- Modify: `src/lib/utils/product-groups.ts`
- Test: `src/lib/utils/product-groups.test.ts`

**Interfaces:**
- Consumes: nada nuevo (extiende tipos existentes).
- Produces: `VariantWithProduct.supplier_id: string | null`, `VariantWithProduct.cost_price: number`, `ProductGroup.supplierId: string | null`, `ProductGroup.costPrice: number`. Usados por Task 6.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `src/lib/utils/product-groups.test.ts` (dentro del `describe('buildProductGroups', ...)`  existente, como último `it`):

```ts
  it('pasa supplier_id y cost_price del producto al grupo', () => {
    const groups = buildProductGroups([
      v({ id: 'a', supplier_id: 'sup-1', cost_price: 15000 }),
    ])
    expect(groups[0].supplierId).toBe('sup-1')
    expect(groups[0].costPrice).toBe(15000)
  })
```

Y actualizar el factory `v` al principio del archivo para incluir los campos nuevos:

```ts
const v = (over: Partial<VariantWithProduct>): VariantWithProduct => ({
  id: 'v1', product_id: 'p1', size: '40', stock_quantity: 1,
  brand: 'Adidas', model: 'Campus', color: 'Total Black',
  supplier_id: null, cost_price: 0, ...over,
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/utils/product-groups.test.ts`
Expected: FAIL — `Property 'supplier_id' is missing` (error de tipos) o `groups[0].supplierId` es `undefined`.

- [ ] **Step 3: Implementar**

En `src/lib/utils/product-groups.ts`, extender las interfaces y la agrupación:

```ts
export interface VariantWithProduct {
  id: string
  product_id: string
  size: string
  stock_quantity: number
  brand: string
  model: string
  color: string
  supplier_id: string | null
  cost_price: number
}
```

```ts
export interface ProductGroup {
  productId: string
  brand: string
  model: string
  color: string
  supplierId: string | null
  costPrice: number
  sizes: SizeCell[]
  totalStock: number
  minStock: number
}
```

En `buildProductGroups`, el `map` interno guarda también `supplier_id`/`cost_price`:

```ts
export function buildProductGroups(variants: VariantWithProduct[]): ProductGroup[] {
  const map = new Map<string, {
    brand: string; model: string; color: string
    supplierId: string | null; costPrice: number
    bySize: Map<string, { qty: number; variantId: string }>
  }>()

  for (const v of variants) {
    let group = map.get(v.product_id)
    if (!group) {
      group = {
        brand: v.brand, model: v.model, color: v.color,
        supplierId: v.supplier_id, costPrice: v.cost_price,
        bySize: new Map(),
      }
      map.set(v.product_id, group)
    }
    group.bySize.set(v.size, { qty: v.stock_quantity, variantId: v.id })
  }

  const result: ProductGroup[] = []
  for (const [productId, group] of map) {
    const sizeSet = new Set<string>([...SIZE_RANGE, ...group.bySize.keys()])
    const orderedSizes = [...sizeSet].sort((a, b) => Number(a) - Number(b))

    const sizes: SizeCell[] = orderedSizes.map(size => {
      const cell = group.bySize.get(size)
      return { size, qty: cell?.qty ?? 0, variantId: cell?.variantId ?? null }
    })

    let totalStock = 0
    let minStock = Infinity
    for (const { qty } of group.bySize.values()) {
      totalStock += qty
      minStock = Math.min(minStock, qty)
    }

    result.push({
      productId, brand: group.brand, model: group.model, color: group.color,
      supplierId: group.supplierId, costPrice: group.costPrice,
      sizes, totalStock, minStock,
    })
  }

  return result.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.color.localeCompare(b.color))
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/utils/product-groups.test.ts`
Expected: PASS (todos los tests, incluido el nuevo)

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/product-groups.ts src/lib/utils/product-groups.test.ts
git commit -m "feat(stock): pasar supplier_id y cost_price del producto al ProductGroup"
```

---

### Task 2: `purchases.ts` — extraer `insertPurchaseRecord`

**Files:**
- Modify: `src/app/actions/purchases.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `insertPurchaseRecord(supabase, input): Promise<{ purchaseId?: string; error?: string }>`, exportado. Firma exacta de `input`:
  ```ts
  interface PurchaseRecordItem {
    variant_id: string
    product_label: string | null
    size_label: string | null
    quantity: number
    unit_cost: number
  }
  interface InsertPurchaseRecordInput {
    supplier_id: string
    purchase_date: string
    payment_status: PaymentStatus
    delivery_status: DeliveryStatus
    payment_due_date: string | null
    notes: string | null
    created_by: string
    items: PurchaseRecordItem[]
  }
  ```
  Usado por Task 3 y Task 4 (`products.ts`).
- `createPurchase` mantiene su firma pública actual (`CreatePurchaseInput` sin cambios) — este refactor no debe cambiar su comportamiento observable.

- [ ] **Step 1: Reemplazar el cuerpo de `createPurchase` y agregar `insertPurchaseRecord`**

En `src/app/actions/purchases.ts`, reemplazar todo el archivo desde el inicio hasta el final de `createPurchase` (líneas 1–112 del archivo actual) por:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus, DeliveryStatus } from '@/types/database'
import { sumByVariant, stockDelta, negativeAfterDelta } from '@/lib/utils/stock-delta'

interface PurchaseItemInput {
  variant_id: string
  quantity: number
  unit_cost: number
}

interface CreatePurchaseInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  payment_due_date: string | null
  notes: string | null
  items: PurchaseItemInput[]
}

export interface PurchaseRecordItem {
  variant_id: string
  product_label: string | null
  size_label: string | null
  quantity: number
  unit_cost: number
}

export interface InsertPurchaseRecordInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  payment_due_date: string | null
  notes: string | null
  created_by: string
  items: PurchaseRecordItem[]
}

/**
 * Inserta una compra y sus ítems. NO toca stock: quien la llama decide si
 * corresponde sumarlo (createPurchase lo hace si delivery_status es
 * 'recibido'; products.ts no, porque el alta/edición de variante ya deja
 * el stock en su valor final).
 */
export async function insertPurchaseRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: InsertPurchaseRecordInput
): Promise<{ purchaseId?: string; error?: string }> {
  const total = input.items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .insert({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      total_amount: total,
      payment_status: input.payment_status,
      delivery_status: input.delivery_status,
      payment_due_date: input.payment_due_date,
      notes: input.notes,
      created_by: input.created_by,
    })
    .select('id')
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'No se pudo registrar la compra' }

  const { error: iErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => ({
      purchase_id: purchase.id,
      variant_id: i.variant_id,
      product_label: i.product_label,
      size_label: i.size_label,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.unit_cost * i.quantity,
    }))
  )
  if (iErr) {
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: iErr.message }
  }

  return { purchaseId: purchase.id }
}

/**
 * Registra una compra a proveedor: inserta la compra y sus items (con snapshot
 * de nombre y talle) y suma el stock de cada variante.
 */
export async function createPurchase(input: CreatePurchaseInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.supplier_id) return { error: 'Seleccioná un proveedor' }
  if (!input.items?.length) return { error: 'Agregá al menos un producto' }

  const ids = [...new Set(input.items.map(i => i.variant_id))]
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity, products(brand, model, color)')
    .in('id', ids)
  if (varErr) return { error: varErr.message }

  type Row = {
    id: string; size: string; stock_quantity: number
    products: { brand: string; model: string; color: string } | null
  }
  const byId = new Map((variants as unknown as Row[] ?? []).map(v => [v.id, v]))

  const qtyById = new Map<string, number>()
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.variant_id)) return { error: 'Uno de los productos no existe' }
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
  }

  const { purchaseId, error: insertErr } = await insertPurchaseRecord(supabase, {
    supplier_id: input.supplier_id,
    purchase_date: input.purchase_date,
    payment_status: input.payment_status,
    delivery_status: input.delivery_status,
    payment_due_date: input.payment_due_date,
    notes: input.notes,
    created_by: user.id,
    items: input.items.map(i => {
      const v = byId.get(i.variant_id)!
      return {
        variant_id: i.variant_id,
        product_label: v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: v.size,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      }
    }),
  })
  if (insertErr || !purchaseId) return { error: insertErr ?? 'No se pudo registrar la compra' }

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

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

El resto del archivo (`receivePurchase`, `deletePurchase`, `UpdatePurchaseInput`, `updatePurchase`) queda **sin cambios**, tal cual está hoy a continuación de `createPurchase`.

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso, sin errores de tipos en `purchases.ts`.

- [ ] **Step 3: Verificación manual de regresión**

Con `npm run dev` corriendo, ir a `/compras` → "Nueva compra", cargar un proveedor + un producto + cantidad + costo, guardar. Confirmar que la compra aparece en la lista con el stock sumado en `/stock`. Esto confirma que el refactor no rompió el flujo existente.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/purchases.ts
git commit -m "refactor(compras): extraer insertPurchaseRecord de createPurchase"
```

---

### Task 3: `products.ts` — `createProduct` genera la compra del stock inicial

**Files:**
- Modify: `src/app/actions/products.ts`

**Interfaces:**
- Consumes: `insertPurchaseRecord` de `src/app/actions/purchases.ts` (Task 2).
- Produces: `createProduct` mantiene su firma pública (`(input: ProductInput) => Promise<{ error?: string }>`), agrega validación y efecto secundario (compra) sin romper el contrato para `product-form.tsx`.

- [ ] **Step 1: Implementar**

En `src/app/actions/products.ts`, agregar el import y reemplazar `createProduct`:

```ts
import { insertPurchaseRecord } from './purchases'
import { argDateStr } from '@/lib/utils/format'
```

```ts
/** Crea el producto y una variante por cada talle con stock > 0. Si hay stock
 *  inicial, además registra una compra al proveedor (sin volver a sumar
 *  stock: ya quedó en su valor final al insertar la variante). */
export async function createProduct(input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const hasInitialStock = input.variants.some(v => v.stock_quantity > 0)
  if (hasInitialStock && !input.supplier_id) {
    return { error: 'Seleccioná un proveedor: vas a cargar stock inicial y se registra como compra' }
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert(productFields(input))
    .select('id')
    .single()
  if (error || !product) return { error: error?.message ?? 'No se pudo crear el producto' }

  const variants = input.variants
    .filter(v => v.stock_quantity > 0)
    .map(v => ({ product_id: product.id, size: v.size, stock_quantity: v.stock_quantity }))

  if (variants.length > 0) {
    const { data: inserted, error: vErr } = await supabase
      .from('product_variants')
      .insert(variants)
      .select('id, size, stock_quantity')
    if (vErr) {
      await supabase.from('products').delete().eq('id', product.id)
      return { error: vErr.message }
    }

    if (input.supplier_id) {
      const { error: purchErr } = await insertPurchaseRecord(supabase, {
        supplier_id: input.supplier_id,
        purchase_date: argDateStr(),
        payment_status: 'pendiente',
        delivery_status: 'recibido',
        payment_due_date: null,
        notes: null,
        created_by: user.id,
        items: (inserted ?? []).map(v => ({
          variant_id: v.id,
          product_label: `${input.brand} ${input.model} ${input.color}`,
          size_label: v.size,
          quantity: v.stock_quantity,
          unit_cost: input.cost_price,
        })),
      })
      if (purchErr) return { error: `Producto creado, pero falló registrar la compra: ${purchErr}` }
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

`updateProduct`, `deleteProduct` y `ensureVariant` quedan sin cambios en este task (se tocan en el Task 4).

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificación manual**

Con `npm run dev`, ir a Catálogo → "Nuevo producto":
1. Cargar marca/modelo/color/costo/precio, dejar "Sin proveedor", poner stock > 0 en un talle, guardar → debe mostrar el error "Seleccioná un proveedor...".
2. Elegir un proveedor, guardar → debe crear el producto. Ir a `/compras` y confirmar que apareció una compra nueva a ese proveedor con los talles cargados, costo unitario = costo del producto, estado "Recibido" y "Pendiente" de pago.
3. Confirmar en `/stock` que el stock del producto coincide con lo cargado (no se duplicó).

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/products.ts
git commit -m "feat(catalogo): crear producto con stock inicial registra compra al proveedor"
```

---

### Task 4: `products.ts` — `updateProduct` genera compra por los talles que suben

**Files:**
- Modify: `src/app/actions/products.ts`

**Interfaces:**
- Consumes: `insertPurchaseRecord` (Task 2).
- Produces: `updateProduct` mantiene su firma pública. Los talles con delta negativo siguen generando `stock_adjustments` (`ajuste_manual`) exactamente como antes; los de delta positivo dejan de generarlo y en su lugar entran a una compra.

- [ ] **Step 1: Implementar**

Reemplazar `updateProduct` completo por:

```ts
/**
 * Edita el producto y sincroniza sus talles. Los talles que suben stock se
 * agrupan en una compra al proveedor (no generan stock_adjustment); los que
 * bajan siguen dejando registro en stock_adjustments como antes. Los talles
 * que quedan en 0 NO se borran (se conservan como variante con stock 0 para
 * no perder su historial).
 */
export async function updateProduct(productId: string, input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('products').update(productFields(input)).eq('id', productId)
  if (error) return { error: error.message }

  const { data: existing, error: exErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity')
    .eq('product_id', productId)
  if (exErr) return { error: exErr.message }

  const bySize = new Map((existing ?? []).map(v => [v.size, v]))

  const hasPositiveDelta = input.variants.some(wanted => {
    const current = bySize.get(wanted.size)
    return wanted.stock_quantity > (current?.stock_quantity ?? 0)
  })
  if (hasPositiveDelta && !input.supplier_id) {
    return { error: 'Seleccioná un proveedor: vas a sumar stock y se registra como compra' }
  }

  const purchaseItems: { variant_id: string; size_label: string; quantity: number }[] = []

  for (const wanted of input.variants) {
    const current = bySize.get(wanted.size)
    if (!current) {
      if (wanted.stock_quantity > 0) {
        const { data: created, error: insErr } = await supabase
          .from('product_variants')
          .insert({ product_id: productId, size: wanted.size, stock_quantity: wanted.stock_quantity })
          .select('id')
          .single()
        if (insErr || !created) return { error: insErr?.message ?? 'No se pudo crear el talle' }
        purchaseItems.push({ variant_id: created.id, size_label: wanted.size, quantity: wanted.stock_quantity })
      }
      continue
    }
    const delta = wanted.stock_quantity - current.stock_quantity
    if (delta !== 0) {
      const { error: updErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: wanted.stock_quantity })
        .eq('id', current.id)
      if (updErr) return { error: updErr.message }

      if (delta > 0) {
        purchaseItems.push({ variant_id: current.id, size_label: wanted.size, quantity: delta })
      } else {
        const { error: adjErr } = await supabase.from('stock_adjustments').insert({
          variant_id: current.id,
          quantity_change: delta,
          reason: 'ajuste_manual',
          notes: 'Corrección desde catálogo',
          created_by: user.id,
        })
        if (adjErr) return { error: adjErr.message }
      }
    }
    bySize.delete(wanted.size)
  }

  if (purchaseItems.length > 0) {
    const { error: purchErr } = await insertPurchaseRecord(supabase, {
      supplier_id: input.supplier_id!,
      purchase_date: argDateStr(),
      payment_status: 'pendiente',
      delivery_status: 'recibido',
      payment_due_date: null,
      notes: null,
      created_by: user.id,
      items: purchaseItems.map(i => ({
        variant_id: i.variant_id,
        product_label: `${input.brand} ${input.model} ${input.color}`,
        size_label: i.size_label,
        quantity: i.quantity,
        unit_cost: input.cost_price,
      })),
    })
    if (purchErr) return { error: `Producto actualizado, pero falló registrar la compra: ${purchErr}` }
  }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificación manual**

Con `npm run dev`, editar un producto existente desde Catálogo:
1. Subir el stock de un talle y bajar el de otro en la misma edición, con proveedor asignado → guardar. Confirmar en `/compras` que se creó UNA compra con solo el ítem que subió (cantidad = la diferencia), y en el historial de ajustes (si hay UI para verlo, o vía Supabase) que el talle que bajó generó un `stock_adjustment` y NO entró a la compra.
2. Repetir sin proveedor asignado en el producto → debe bloquear con el error de "Seleccioná un proveedor...".
3. Confirmar que el stock final de cada talle en `/stock` es correcto en ambos casos.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/products.ts
git commit -m "feat(catalogo): subir stock al editar producto registra compra al proveedor"
```

---

### Task 5: `product-form.tsx` — validar proveedor en el cliente

**Files:**
- Modify: `src/components/products/product-form.tsx`

**Interfaces:**
- Consumes: nada nuevo (usa el estado `stock`/`stockBySize` ya existente en el componente).
- Produces: nada consumido por otras tasks — es una mejora de UX que replica la validación del server action para dar feedback inmediato sin round-trip.

- [ ] **Step 1: Implementar**

En `src/components/products/product-form.tsx`, dentro de `onSubmit`, agregar la validación al principio (antes de construir `input`):

```ts
  async function onSubmit(data: ProductFormData) {
    setError(null)

    const hasPositiveDelta = sizes.some(size => (stock[size] ?? 0) > (stockBySize[size] ?? 0))
    if (hasPositiveDelta && !data.supplier_id) {
      setError('Seleccioná un proveedor: vas a sumar stock y se registra como compra')
      return
    }

    const input = {
      brand: data.brand, model: data.model, color: data.color,
      gender: data.gender ?? null,
      cost_price: data.cost_price, sale_price: data.sale_price,
      supplier_id: data.supplier_id || null,
      active: data.active,
      variants: sizes.map(size => ({ size, stock_quantity: stock[size] ?? 0 })),
    }
    const { error: err } = editing
      ? await updateProduct(product!.id, input)
      : await createProduct(input)
    if (err) { setError(err); return }
    toast.success(editing ? 'Producto actualizado' : 'Producto agregado')
    router.refresh()
    onSuccess?.()
  }
```

(Solo cambia el inicio de la función — se agregan las 5 líneas de validación entre `setError(null)` y `const input = {`; el resto queda igual.)

- [ ] **Step 2: Verificar que compila**

Run: `npm run build`
Expected: build exitoso.

- [ ] **Step 3: Verificación manual**

Con `npm run dev`, abrir "Nuevo producto", poner stock en un talle sin elegir proveedor, click "Guardar producto" → debe mostrar el error al instante, sin llamar al server (se puede confirmar viendo que no hay loading state ni llamada de red en las devtools).

- [ ] **Step 4: Commit**

```bash
git add src/components/products/product-form.tsx
git commit -m "feat(catalogo): validar proveedor en el cliente antes de enviar stock en alza"
```

---

### Task 6: `/stock` — compra automática en el ajuste rápido de talle

Se hace de punta a punta en una sola tarea (query de la página → props del badge → lógica del formulario) porque son tres archivos que solo compilan juntos: `stock-badge-button.tsx` pasa props nuevas que `adjustment-form.tsx` recién acepta en este mismo cambio.

**Files:**
- Modify: `src/app/(dashboard)/stock/page.tsx`
- Modify: `src/components/stock/stock-badge-button.tsx`
- Modify: `src/components/stock/adjustment-form.tsx`

**Interfaces:**
- Consumes: `ProductGroup.supplierId`/`ProductGroup.costPrice` (Task 1); `createPurchase` de `src/app/actions/purchases.ts` (firma existente, sin cambios); `formatDateForInput` de `src/lib/utils/format.ts`.
- Produces: nada consumido por otras tasks — es la última pieza de la cadena de `/stock`.

- [ ] **Step 1: Implementar `stock/page.tsx`**

Reemplazar el cuerpo de `StockPage` (todo el archivo actual) por:

```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StockBadgeButton } from '@/components/stock/stock-badge-button'
import { ExportCsvButton } from '@/components/common/export-csv-button'
import { buildProductGroups, type VariantWithProduct } from '@/lib/utils/product-groups'

export default async function StockPage() {
  const supabase = await createClient()
  const [{ data }, { data: suppliersData }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, active, supplier_id, cost_price)'),
    supabase.from('suppliers').select('id, name').order('name'),
  ])
  const suppliers = suppliersData ?? []

  type Row = {
    id: string; product_id: string; size: string; stock_quantity: number
    products: {
      brand: string; model: string; color: string; active: boolean
      supplier_id: string | null; cost_price: number
    } | null
  }
  const rows = ((data as unknown as Row[]) ?? []).filter(r => r.products?.active)

  const variants: VariantWithProduct[] = rows.map(r => ({
    id: r.id, product_id: r.product_id, size: r.size, stock_quantity: r.stock_quantity,
    brand: r.products!.brand, model: r.products!.model, color: r.products!.color,
    supplier_id: r.products!.supplier_id, cost_price: r.products!.cost_price,
  }))
  const groups = buildProductGroups(variants)

  const totalVariants = rows.length
  const sinStock = rows.filter(r => r.stock_quantity === 0).length
  const stockBajo = rows.filter(r => r.stock_quantity === 1).length
  const stockOk = totalVariants - sinStock - stockBajo

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock</h1>
          <p className="text-sm text-foreground/55 mt-0.5">Vista por modelo y talle</p>
        </div>
        <ExportCsvButton
          filename="stock.csv"
          headers={['Marca', 'Modelo', 'Color', 'Talle', 'Stock']}
          rows={rows.map(r => [r.products!.brand, r.products!.model, r.products!.color, r.size, r.stock_quantity])}
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Talles cargados', value: totalVariants, color: 'text-foreground' },
          { label: 'OK', value: stockOk, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Stock bajo', value: stockBajo, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Sin stock', value: sinStock, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-foreground/[0.08] rounded-xl p-4 text-center">
            <p className={`font-mono text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-foreground/55 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs text-foreground/55">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />2+ unidades</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />1 unidad</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />Sin stock</span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">No hay productos cargados aún.</p>
          <Link href="/catalogo" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">Ir al catálogo →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const hasCritical = group.minStock === 0
            const hasLow = !hasCritical && group.minStock === 1
            return (
              <div key={group.productId} className={`rounded-xl border bg-card p-5 transition-colors ${hasCritical ? 'border-red-500/20' : hasLow ? 'border-amber-500/20' : 'border-foreground/[0.08]'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{group.brand} {group.model}</h3>
                    <p className="text-xs text-foreground/55 mt-0.5">{group.color}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-foreground/45">Stock total</p>
                    <p className={`font-mono text-lg font-semibold tabular-nums ${hasCritical ? 'text-red-600 dark:text-red-400' : hasLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{group.totalStock}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.sizes.map(({ size, qty, variantId }) => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <StockBadgeButton
                        variantId={variantId}
                        productId={group.productId}
                        productName={`${group.brand} ${group.model} ${group.color}`}
                        size={size}
                        qty={qty}
                        supplierId={group.supplierId}
                        costPrice={group.costPrice}
                        suppliers={suppliers}
                      />
                      <span className="text-[10px] text-foreground/45">T{size}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Implementar `stock-badge-button.tsx`**

Reemplazar `src/components/stock/stock-badge-button.tsx` completo por:

```tsx
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AdjustmentForm } from './adjustment-form'
import type { Supplier } from '@/types/database'

function badgeClass(qty: number) {
  if (qty === 0) return 'bg-transparent border-foreground/10 text-foreground/35 line-through'
  if (qty === 1) return 'bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400'
  return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
}

interface StockBadgeButtonProps {
  variantId: string | null
  productId: string
  productName: string
  size: string
  qty: number
  supplierId: string | null
  costPrice: number
  suppliers: Pick<Supplier, 'id' | 'name'>[]
}

export function StockBadgeButton({
  variantId, productId, productName, size, qty, supplierId, costPrice, suppliers,
}: StockBadgeButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            title={`Ajustar stock · T${size}`}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${badgeClass(qty)}`}
          />
        }
      >
        {qty}
      </DialogTrigger>
      <DialogContent className="max-w-sm bg-card border-foreground/10">
        <DialogHeader>
          <DialogTitle className="text-foreground">Ajustar stock · T{size}</DialogTitle>
        </DialogHeader>
        <AdjustmentForm
          variantId={variantId}
          productId={productId}
          size={size}
          productName={`${productName} · T${size}`}
          currentStock={qty}
          supplierId={supplierId}
          costPrice={costPrice}
          suppliers={suppliers}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Implementar `adjustment-form.tsx`**

Reemplazar `src/components/stock/adjustment-form.tsx` completo por:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { adjustStock } from '@/app/actions/stock'
import { createPurchase } from '@/app/actions/purchases'
import { ensureVariant } from '@/app/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateForInput } from '@/lib/utils/format'
import type { AdjustmentReason, Supplier } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

interface AdjustmentFormProps {
  variantId: string | null
  productId: string
  size: string
  productName: string
  currentStock: number
  supplierId: string | null
  costPrice: number
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  onClose: () => void
}

export function AdjustmentForm({
  variantId, productId, size, productName, currentStock,
  supplierId, costPrice, suppliers, onClose,
}: AdjustmentFormProps) {
  const router = useRouter()
  const [quantityChange, setQuantityChange] = useState(0)
  const [reason, setReason] = useState<AdjustmentReason>('ajuste_manual')
  const [notes, setNotes] = useState('')
  const [supplier, setSupplier] = useState(supplierId ?? '')
  const [unitCost, setUnitCost] = useState(costPrice)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resultingStock = currentStock + quantityChange
  const isPurchase = quantityChange > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (quantityChange === 0) { setError('El cambio debe ser distinto de 0'); return }
    if (resultingStock < 0) { setError('El stock no puede quedar negativo'); return }
    if (isPurchase && !supplier) { setError('Seleccioná un proveedor'); return }
    setLoading(true)

    // Si el talle todavía no existe como variante, crearlo primero.
    let vId = variantId
    if (!vId) {
      const { id, error: ensureErr } = await ensureVariant(productId, size)
      if (ensureErr || !id) { setError(ensureErr ?? 'No se pudo crear el talle'); setLoading(false); return }
      vId = id
    }

    if (isPurchase) {
      const { error: purchErr } = await createPurchase({
        supplier_id: supplier,
        purchase_date: formatDateForInput(),
        payment_status: 'pendiente',
        delivery_status: 'recibido',
        payment_due_date: null,
        notes: null,
        items: [{ variant_id: vId, quantity: quantityChange, unit_cost: unitCost }],
      })
      if (purchErr.error) { setError(purchErr.error); setLoading(false); return }
      toast.success(`Stock sumado a ${resultingStock} ud. — compra registrada`)
    } else {
      const { error: adjErr } = await adjustStock(vId, quantityChange, reason, notes)
      if (adjErr) { setError(adjErr); setLoading(false); return }
      toast.success(`Stock ajustado a ${resultingStock} ud.`)
    }

    router.refresh()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-foreground/[0.08] bg-card px-3 py-2.5">
        <p className="text-sm text-foreground font-medium">{productName}</p>
        <p className="text-xs text-foreground/55 mt-0.5">
          Stock actual: <span className="text-foreground/70 font-semibold">{currentStock}</span> ud.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Stock final</Label>
          <Input
            type="number"
            min={0}
            value={resultingStock}
            onChange={e => setQuantityChange(Number(e.target.value) - currentStock)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Cambio (+/−)</Label>
          <Input
            type="number"
            value={quantityChange}
            onChange={e => setQuantityChange(Number(e.target.value))}
            placeholder="+5 o -3"
          />
        </div>
        <p className="col-span-2 text-xs text-foreground/55">
          Escribí el stock final directamente, o el cambio (ej: +5 llegaron, −3 rotos). Quedará:{' '}
          <span className={`font-mono font-semibold tabular-nums ${resultingStock < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {resultingStock} ud.
          </span>
        </p>
      </div>

      {isPurchase ? (
        <>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Proveedor</Label>
            <select value={supplier} onChange={e => setSupplier(e.target.value)} className={sel}>
              <option value="" className="bg-card">Seleccionar proveedor</option>
              {suppliers.map(s => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
            </select>
            <p className="text-xs text-foreground/55">Sumar stock se registra como una compra a este proveedor.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Costo unitario ($)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={unitCost}
              onChange={e => setUnitCost(Number(e.target.value))}
            />
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Motivo</Label>
            <select value={reason} onChange={e => setReason(e.target.value as AdjustmentReason)} className={sel}>
              <option value="ajuste_manual" className="bg-card">Ajuste manual</option>
              <option value="rotura" className="bg-card">Rotura</option>
              <option value="perdida" className="bg-card">Pérdida</option>
              <option value="devolucion_proveedor" className="bg-card">Devolución a proveedor</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Notas (opcional)</Label>
            <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: conteo físico de cierre de mes" />
          </div>
        </>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Guardando...' : isPurchase ? 'Registrar compra' : 'Confirmar ajuste'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

Nota: `createPurchase` devuelve `{ error?: string }`; el destructuring anterior usa `purchErr` como el objeto completo (`{ error?: string }`) y luego chequea `purchErr.error`, para no chocar de nombre con la variable `error` del estado del componente.

- [ ] **Step 4: Verificar que compila**

Run: `npm run build`
Expected: build exitoso (los tres archivos de este task compilan juntos).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(dashboard)/stock/page.tsx" src/components/stock/stock-badge-button.tsx src/components/stock/adjustment-form.tsx
git commit -m "feat(stock): sumar stock en /stock registra compra automatica al proveedor"
```

---

### Task 7: Verificación manual end-to-end

**Files:** ninguno (solo verificación).

- [ ] **Step 1: Build limpio**

Run: `npm run build`
Expected: sin errores.

- [ ] **Step 2: Suite de Vitest completa**

Run: `npm test`
Expected: todos los tests pasan, incluidos los de `product-groups.test.ts` (Task 1) y `stock-delta.test.ts` (sin cambios, deben seguir en verde).

- [ ] **Step 3: Recorrido manual en el navegador**

Con `npm run dev`:

1. **`/stock`, talle sin proveedor asignado en el producto**: sumar stock (+3) → pide proveedor, no deja confirmar sin elegir uno. Elegir proveedor + costo, confirmar → aparece la compra en `/compras` y en la ficha de ese proveedor (`/proveedores/[id]`), con `delivery_status: recibido` y `payment_status: pendiente`.
2. **`/stock`, talle con proveedor ya asignado**: sumar stock → proveedor y costo vienen precargados. Confirmar → misma verificación que el punto anterior.
3. **`/stock`, cambio negativo** (rotura/pérdida/devolución/corrección a la baja): sigue mostrando el selector de motivo de siempre, sin pedir proveedor, y no genera ninguna compra.
4. **Catálogo → Nuevo producto** con stock inicial en varios talles y proveedor elegido: se crea UNA compra con un ítem por talle.
5. **Catálogo → Editar producto**, subir un talle y bajar otro en la misma edición: se crea una compra solo con el talle que subió; el que bajó no aparece en la compra.
6. **Stock final correcto** en `/stock` después de cada uno de los pasos anteriores (no debe haber duplicación ni faltantes).

- [ ] **Step 4: Commit final (si hubo ajustes durante la verificación)**

Si algún paso de la verificación manual requirió un fix, commitear ese fix puntual con su propio mensaje descriptivo antes de cerrar el plan. Si todo pasó sin cambios, no hay commit en este paso.
