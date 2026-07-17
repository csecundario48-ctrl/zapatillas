# Edición de registros en todas las secciones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir editar registros en ventas, encargos, compras y egresos —incluyendo sus productos— sin tener que eliminarlos y volver a cargarlos.

**Architecture:** Toda la aritmética del stock vive en una función pura y testeada (`stockDelta`), separada de la base de datos. Dos acciones de servidor nuevas (`updateSale`, `updatePurchase`) leen, validan y escriben usando esa función; los egresos no llevan acción porque no tocan stock. Los formularios de creación existentes ganan un modo edición vía una prop opcional, y el menú de 3 puntitos (`RowMenu`) se vuelve la única entrada a *Editar* y *Eliminar* en toda la app.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript, Supabase, Vitest, Tailwind, Base UI.

**Spec:** `docs/superpowers/specs/2026-07-17-edicion-registros-design.md`

## Global Constraints

- **Editar nunca cambia el estado de un registro.** Ningún formulario de edición incluye el check de "es encargo" ni selectores de `status` / `delivery_status`.
- **El stock solo se mueve si el registro lo retiene:** venta `completada` o compra `recibido`. En cualquier otro estado, editar no toca `product_variants.stock_quantity`.
- **Toda la validación va antes de la primera escritura.** Si una edición dejaría stock negativo, se rechaza entera y no se escribe nada.
- **Los ítems huérfanos se preservan.** El FK es `on delete set null` (ver `supabase/migrations/007_product_variants.sql:96-102`), así que borrar un producto deja `sale_items.variant_id` / `purchase_items.variant_id` en `null` conservando el snapshot histórico. Esos ítems **nunca se borran ni se reescriben** al editar, y siguen sumando al total.
- **Los snapshots se preservan:** un ítem que ya estaba en el registro mantiene su `unit_cost`, `product_label` y `size_label` originales. Solo los ítems recién agregados toman los valores de hoy.
- **Convención de las acciones:** `'use server'`, retorno `{ error?: string }`, `revalidatePath` de las rutas afectadas al final. Mensajes de error en español, en el tono de los existentes.
- **Este proyecto solo testea utilidades puras** con Vitest (`src/lib/utils/*.test.ts`). No hay tests de componentes ni de acciones. La Task 1 es TDD; el resto se verifica con `npx tsc --noEmit`, `npm run lint` y prueba manual.

**Comandos:**
- Tests: `npm test` (o `npx vitest run <archivo>` para uno solo)
- Typecheck: `npx tsc --noEmit`
- Lint: `npm run lint`
- Dev server: `npm run dev`

---

### Task 1: `stockDelta` — la aritmética del stock

El archivo `purchase-stock.ts` ya tiene `sumByVariant`, pero deja de ser solo de compras cuando las ventas usan la misma aritmética. Se renombra a `stock-delta.ts` y se le agregan las dos funciones que necesita la edición.

**Files:**
- Create: `src/lib/utils/stock-delta.ts` (reemplaza `src/lib/utils/purchase-stock.ts`)
- Create: `src/lib/utils/stock-delta.test.ts` (reemplaza `src/lib/utils/purchase-stock.test.ts`)
- Delete: `src/lib/utils/purchase-stock.ts`, `src/lib/utils/purchase-stock.test.ts`
- Modify: `src/app/actions/purchases.ts:6` (el import)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type ItemQty = { variant_id: string | null; quantity: number }`
  - `type StockShortfall = { variant_id: string; current: number; needed: number }`
  - `sumByVariant(items: ItemQty[]): Map<string, number>` (ya existía, se mueve tal cual)
  - `stockDelta(before: ItemQty[], after: ItemQty[], direction: 'venta' | 'compra'): Map<string, number>`
  - `negativeAfterDelta(deltas: Map<string, number>, currentStock: Map<string, number>): StockShortfall[]`

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/utils/stock-delta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { sumByVariant, stockDelta, negativeAfterDelta } from './stock-delta'

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

describe('stockDelta', () => {
  it('sin cambios devuelve mapa vacío (editar solo la fecha no mueve stock)', () => {
    const items = [{ variant_id: 'a', quantity: 2 }]
    expect(stockDelta(items, items, 'venta').size).toBe(0)
    expect(stockDelta(items, items, 'compra').size).toBe(0)
  })

  it('venta: subir la cantidad resta más stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 2 }], [{ variant_id: 'a', quantity: 3 }], 'venta')
    expect(d.get('a')).toBe(-1)
  })

  it('venta: bajar la cantidad devuelve stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 3 }], [{ variant_id: 'a', quantity: 1 }], 'venta')
    expect(d.get('a')).toBe(2)
  })

  it('compra: subir la cantidad suma más stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 2 }], [{ variant_id: 'a', quantity: 5 }], 'compra')
    expect(d.get('a')).toBe(3)
  })

  it('compra: bajar la cantidad resta stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 5 }], [{ variant_id: 'a', quantity: 2 }], 'compra')
    expect(d.get('a')).toBe(-3)
  })

  it('venta: agregar un ítem nuevo resta su cantidad', () => {
    const d = stockDelta([], [{ variant_id: 'a', quantity: 2 }], 'venta')
    expect(d.get('a')).toBe(-2)
  })

  it('venta: quitar un ítem devuelve todas sus unidades', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 2 }], [], 'venta')
    expect(d.get('a')).toBe(2)
  })

  it('venta: reemplazar un producto por otro devuelve uno y resta el otro', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 1 }], [{ variant_id: 'b', quantity: 1 }], 'venta')
    expect(d.get('a')).toBe(1)
    expect(d.get('b')).toBe(-1)
    expect(d.size).toBe(2)
  })

  it('agrupa el mismo variante repetido antes de comparar', () => {
    const d = stockDelta(
      [{ variant_id: 'a', quantity: 1 }, { variant_id: 'a', quantity: 1 }],
      [{ variant_id: 'a', quantity: 2 }],
      'venta'
    )
    expect(d.size).toBe(0)
  })

  it('ignora los ítems huérfanos (variant_id null) de los dos lados', () => {
    const d = stockDelta(
      [{ variant_id: null, quantity: 5 }],
      [{ variant_id: null, quantity: 9 }],
      'venta'
    )
    expect(d.size).toBe(0)
  })

  it('devuelve mapa vacío con los dos lados vacíos', () => {
    expect(stockDelta([], [], 'venta').size).toBe(0)
  })
})

describe('negativeAfterDelta', () => {
  it('no reporta nada si el stock alcanza', () => {
    const short = negativeAfterDelta(new Map([['a', -2]]), new Map([['a', 5]]))
    expect(short).toEqual([])
  })

  it('no reporta nada cuando el stock queda justo en cero', () => {
    const short = negativeAfterDelta(new Map([['a', -5]]), new Map([['a', 5]]))
    expect(short).toEqual([])
  })

  it('reporta la variante que quedaría negativa con sus números', () => {
    const short = negativeAfterDelta(new Map([['a', -3]]), new Map([['a', 1]]))
    expect(short).toEqual([{ variant_id: 'a', current: 1, needed: 3 }])
  })

  it('un delta positivo nunca es reportado', () => {
    const short = negativeAfterDelta(new Map([['a', 4]]), new Map([['a', 0]]))
    expect(short).toEqual([])
  })

  it('trata una variante sin stock conocido como cero', () => {
    const short = negativeAfterDelta(new Map([['a', -1]]), new Map())
    expect(short).toEqual([{ variant_id: 'a', current: 0, needed: 1 }])
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/utils/stock-delta.test.ts`
Expected: FAIL — `Failed to resolve import "./stock-delta"`.

- [ ] **Step 3: Escribir la implementación**

Crear `src/lib/utils/stock-delta.ts`:

```ts
export type ItemQty = { variant_id: string | null; quantity: number }

/** Una variante que quedaría con stock negativo. `needed` es cuánto se intenta restar. */
export type StockShortfall = { variant_id: string; current: number; needed: number }

/** Suma cantidades por variante. Ignora ítems sin variant_id (producto borrado). */
export function sumByVariant(items: ItemQty[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    if (!it.variant_id) continue
    m.set(it.variant_id, (m.get(it.variant_id) ?? 0) + it.quantity)
  }
  return m
}

/**
 * Cuánto hay que sumarle al stock de cada variante para pasar de `before` a `after`.
 *
 * `direction` es 'venta' cuando los ítems restan stock y 'compra' cuando lo suman.
 * Omite las variantes cuyo delta da 0, de modo que una edición que no toca los
 * productos (corregir la fecha, por ejemplo) devuelve un mapa vacío.
 */
export function stockDelta(
  before: ItemQty[],
  after: ItemQty[],
  direction: 'venta' | 'compra'
): Map<string, number> {
  const sign = direction === 'venta' ? -1 : 1
  const b = sumByVariant(before)
  const a = sumByVariant(after)
  const out = new Map<string, number>()
  for (const id of new Set([...b.keys(), ...a.keys()])) {
    const delta = sign * ((a.get(id) ?? 0) - (b.get(id) ?? 0))
    if (delta !== 0) out.set(id, delta)
  }
  return out
}

/** Las variantes que quedarían con stock negativo al aplicar `deltas`. */
export function negativeAfterDelta(
  deltas: Map<string, number>,
  currentStock: Map<string, number>
): StockShortfall[] {
  const out: StockShortfall[] = []
  for (const [variantId, delta] of deltas) {
    const current = currentStock.get(variantId) ?? 0
    if (current + delta < 0) {
      out.push({ variant_id: variantId, current, needed: -delta })
    }
  }
  return out
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Run: `npx vitest run src/lib/utils/stock-delta.test.ts`
Expected: PASS — 19 tests.

- [ ] **Step 5: Borrar los archivos viejos y actualizar el import**

```bash
git rm src/lib/utils/purchase-stock.ts src/lib/utils/purchase-stock.test.ts
```

En `src/app/actions/purchases.ts` línea 6, cambiar:

```ts
import { sumByVariant } from '@/lib/utils/purchase-stock'
```

por:

```ts
import { sumByVariant } from '@/lib/utils/stock-delta'
```

- [ ] **Step 6: Verificar que no quedaron referencias al archivo viejo**

Run: `grep -rn "purchase-stock" src/`
Expected: sin resultados.

Run: `npm test && npx tsc --noEmit`
Expected: todos los tests pasan, sin errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add src/lib/utils/stock-delta.ts src/lib/utils/stock-delta.test.ts src/app/actions/purchases.ts
git commit -m "feat(stock): stockDelta y negativeAfterDelta para editar registros

Renombra purchase-stock a stock-delta: la aritmetica deja de ser solo
de compras cuando las ventas usan la misma. stockDelta compara los
items viejos con los nuevos y devuelve el cambio neto por variante,
de modo que editar sin tocar productos da un mapa vacio."
```

---

### Task 2: `RowMenu` con opción Editar

**Files:**
- Modify: `src/components/common/row-menu.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `RowMenu` acepta dos props nuevas y opcionales — `onEdit?: () => void` (abre un modal) y `editHref?: string` (navega a una página). Si no se pasa ninguna, el menú muestra solo *Eliminar*, exactamente como hoy.

- [ ] **Step 1: Agregar las props y la opción del menú**

En `src/components/common/row-menu.tsx`, reemplazar el bloque de imports de `lucide-react` y la interfaz `RowMenuProps`:

```tsx
import { MoreVertical, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
```

```tsx
interface RowMenuProps {
  /** Corre el borrado. Devuelve { error } para mostrarlo en un toast. */
  onDelete: () => Promise<{ error?: string }>
  /** Texto de la opción del menú: "Eliminar venta", "Eliminar egreso", etc. */
  deleteLabel?: string
  /** Aclaración dentro del diálogo de confirmación. */
  confirmDescription?: string
  /** Abre la edición en un modal. Excluyente con editHref. */
  onEdit?: () => void
  /** Navega a la página de edición. Excluyente con onEdit. */
  editHref?: string
  /** Texto de la opción de editar: "Editar venta", "Editar egreso", etc. */
  editLabel?: string
}
```

Actualizar la firma del componente:

```tsx
export function RowMenu({
  onDelete,
  deleteLabel = 'Eliminar',
  confirmDescription = 'Esta acción no se puede deshacer.',
  onEdit,
  editHref,
  editLabel = 'Editar',
}: RowMenuProps) {
```

- [ ] **Step 2: Renderizar la opción Editar arriba de Eliminar**

Dentro de `<Menu.Popup>`, antes del `<Menu.Item>` de eliminar, insertar:

```tsx
{editHref && (
  <Menu.Item
    render={<Link href={editHref} />}
    className="flex items-center gap-2 px-2.5 py-2 rounded-md text-foreground/80 cursor-pointer select-none outline-none data-highlighted:bg-foreground/[0.06] data-highlighted:text-foreground"
  >
    <Pencil size={14} />
    {editLabel}
  </Menu.Item>
)}
{onEdit && (
  <Menu.Item
    onClick={onEdit}
    className="flex items-center gap-2 px-2.5 py-2 rounded-md text-foreground/80 cursor-pointer select-none outline-none data-highlighted:bg-foreground/[0.06] data-highlighted:text-foreground"
  >
    <Pencil size={14} />
    {editLabel}
  </Menu.Item>
)}
```

- [ ] **Step 3: Verificar tipos y lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/components/common/row-menu.tsx
git commit -m "feat(ui): RowMenu acepta una opcion Editar

onEdit abre un modal, editHref navega a una pagina. Sin ninguna de las
dos el menu se comporta igual que antes, asi que las llamadas actuales
no cambian."
```

---

### Task 3: Editar egresos

El caso más simple y completo de punta a punta: sin stock, sin acción de servidor, formulario chico en modal. Prueba el patrón antes de aplicarlo a ventas y compras.

**Files:**
- Modify: `src/components/expenses/expense-form.tsx`
- Modify: `src/components/expenses/expense-row-actions.tsx`

**Interfaces:**
- Consumes: `RowMenu` con `onEdit` (Task 2).
- Produces: `ExpenseForm` acepta `expense?: Expense`; sin esa prop sigue en modo crear.

- [ ] **Step 1: `ExpenseForm` acepta un egreso a editar**

En `src/components/expenses/expense-form.tsx`, agregar el import del tipo:

```tsx
import type { Expense } from '@/types/database'
```

Reemplazar la firma y el `useForm` (líneas 17-28):

```tsx
export function ExpenseForm({
  categories,
  expense,
  onSuccess,
}: {
  categories: string[]
  expense?: Expense
  onSuccess?: () => void
}) {
  const isEdit = !!expense
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: expense
      ? {
          category: expense.category,
          type: expense.type,
          description: expense.description ?? '',
          amount: expense.amount,
          expense_date: expense.expense_date,
          payment_method: expense.payment_method ?? '',
          recurring: expense.recurring,
          notes: expense.notes ?? '',
        }
      : { expense_date: formatDateForInput(), recurring: false },
  })
```

- [ ] **Step 2: `onSubmit` hace update en modo edición**

Reemplazar `onSubmit` (líneas 30-39):

```tsx
  async function onSubmit(data: ExpenseFormData) {
    setError(null)
    const supabase = createClient()

    if (isEdit) {
      const { error } = await supabase.from('expenses').update(data).eq('id', expense.id)
      if (error) { setError(error.message); return }
      toast.success('Egreso actualizado')
      router.refresh()
      onSuccess?.()
      return
    }

    const { error } = await supabase.from('expenses').insert(data)
    if (error) { setError(error.message); return }
    toast.success('Egreso registrado')
    reset({ expense_date: formatDateForInput(), recurring: false })
    router.refresh()
    onSuccess?.()
  }
```

- [ ] **Step 3: El botón acompaña el modo**

Reemplazar el `<Button>` del final (líneas 89-91):

```tsx
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting
          ? 'Guardando...'
          : isEdit ? 'Guardar cambios' : 'Registrar egreso'}
      </Button>
```

- [ ] **Step 4: `ExpenseRowActions` ofrece Editar**

Reemplazar `src/components/expenses/expense-row-actions.tsx` entero:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RowMenu } from '@/components/common/row-menu'
import { deleteErrorMessage } from '@/components/common/confirm-delete'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExpenseForm } from './expense-form'
import type { Expense } from '@/types/database'

export function ExpenseRowActions({
  expense,
  categories,
}: {
  expense: Expense
  categories: string[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  async function del() {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) return { error: deleteErrorMessage(error) }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end">
      <RowMenu
        onDelete={del}
        deleteLabel="Eliminar egreso"
        confirmDescription="Se borra el gasto y deja de contarse en Finanzas. No se puede deshacer."
        onEdit={() => setEditing(true)}
        editLabel="Editar egreso"
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="bg-card border-foreground/10 text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar egreso</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            categories={categories}
            expense={expense}
            onSuccess={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 5: La página pasa las props nuevas**

En `src/app/(dashboard)/egresos/page.tsx` línea 99, reemplazar:

```tsx
                    <ExpenseRowActions expenseId={e.id} />
```

por:

```tsx
                    <ExpenseRowActions expense={e} categories={categories} />
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

Manual con `npm run dev`, en `/egresos`:
- El menú de 3 puntitos muestra *Editar egreso* y *Eliminar egreso*.
- Editar abre el modal con todos los campos cargados (categoría, tipo, descripción, monto, fecha, medio de pago, recurrente).
- Cambiar la fecha y guardar: el modal cierra, la tabla muestra la fecha nueva, toast "Egreso actualizado".
- "+ Nuevo egreso" sigue creando igual que antes.

- [ ] **Step 7: Commit**

```bash
git add src/components/expenses/ "src/app/(dashboard)/egresos/page.tsx"
git commit -m "feat(egresos): editar un egreso desde el menu de la fila

ExpenseForm recibe el egreso como prop opcional; sin ella sigue en
modo crear."
```

---

### Task 4: Acción `updateSale`

**Files:**
- Modify: `src/app/actions/sales.ts`

**Interfaces:**
- Consumes: `stockDelta`, `negativeAfterDelta` (Task 1); `isValidDeposit` de `@/lib/utils/deposit`.
- Produces:
  ```ts
  export interface UpdateSaleInput {
    sale_date: string
    channel: SaleChannel
    payment_method: PaymentMethod
    customer_id: string | null
    /** Solo se aplica si la venta está en estado 'encargo'. */
    deposit_amount: number
    items: SaleItemInput[]
  }
  export async function updateSale(
    saleId: string,
    input: UpdateSaleInput
  ): Promise<{ error?: string; movedStock?: boolean }>
  ```
  `SaleItemInput` es la interfaz que ya existe en el archivo (`variant_id`, `quantity`, `unit_price`, `discount`).

- [ ] **Step 1: Actualizar los imports**

En `src/app/actions/sales.ts`, después del import de `deposit` (línea 6), agregar:

```ts
import { stockDelta, negativeAfterDelta } from '@/lib/utils/stock-delta'
```

- [ ] **Step 2: Agregar la acción**

Agregar al final de `src/app/actions/sales.ts`:

```ts
export interface UpdateSaleInput {
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  /** Solo se aplica si la venta está en estado 'encargo'. */
  deposit_amount: number
  items: SaleItemInput[]
}

/**
 * Edita una venta o un encargo sin cambiar su estado.
 *
 * El stock se mueve SOLO si la venta está 'completada', el único estado con
 * unidades descontadas, y se mueve por la DIFERENCIA entre los ítems viejos y
 * los nuevos: corregir la fecha no lo toca, pasar de 2 a 3 pares resta uno.
 *
 * Los ítems cuyo producto se borró del catálogo (variant_id null) se conservan
 * intactos —guardan el historial y no se pueden reeditar— y siguen sumando al
 * total.
 */
export async function updateSale(
  saleId: string,
  input: UpdateSaleInput
): Promise<{ error?: string; movedStock?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.items?.length) return { error: 'Agregá al menos un producto' }
  if (!input.customer_id) return { error: 'Seleccioná un cliente' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, deposit_amount, sale_items(variant_id, quantity, unit_cost, product_label, size_label, subtotal)')
    .eq('id', saleId)
    .single()
  if (saleErr || !sale) return { error: saleErr?.message ?? 'Venta no encontrada' }

  type OldItem = {
    variant_id: string | null
    quantity: number
    unit_cost: number
    product_label: string | null
    size_label: string | null
    subtotal: number
  }
  const oldItems = (sale.sale_items ?? []) as OldItem[]
  const oldByVariant = new Map(
    oldItems.filter(i => i.variant_id).map(i => [i.variant_id as string, i])
  )
  // Los huérfanos no se tocan pero siguen contando en el total.
  const orphanTotal = oldItems
    .filter(i => !i.variant_id)
    .reduce((sum, i) => sum + i.subtotal, 0)

  const ids = [...new Set(input.items.map(i => i.variant_id))]
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity, products(active, brand, model, color, cost_price)')
    .in('id', ids)
  if (varErr) return { error: varErr.message }

  type Row = {
    id: string
    size: string
    stock_quantity: number
    products: { active: boolean; brand: string; model: string; color: string; cost_price: number } | null
  }
  const byId = new Map((variants as unknown as Row[] ?? []).map(v => [v.id, v]))

  let itemsTotal = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    const v = byId.get(item.variant_id)
    if (!v) return { error: 'Uno de los productos ya no existe' }
    // Un producto inactivo puede seguir en la venta, pero no se puede agregar.
    if (!oldByVariant.has(item.variant_id) && !v.products?.active) {
      return { error: 'Uno de los productos está inactivo' }
    }
    itemsTotal += (item.unit_price - item.discount) * item.quantity
  }
  const total = itemsTotal + orphanTotal

  // La seña solo se edita en un encargo; en una venta completada que vino de
  // uno, se preserva.
  const deposit = sale.status === 'encargo' ? input.deposit_amount : sale.deposit_amount
  if (!isValidDeposit(total, deposit)) {
    return { error: 'La seña debe ser mayor o igual a 0 y no puede superar el total' }
  }

  const deltas = sale.status === 'completada'
    ? stockDelta(oldItems, input.items, 'venta')
    : new Map<string, number>()

  // Validar el stock ANTES de escribir nada.
  const stockById = new Map<string, number>()
  const sizeById = new Map<string, string>()
  if (deltas.size > 0) {
    const { data: current, error: curErr } = await supabase
      .from('product_variants')
      .select('id, size, stock_quantity')
      .in('id', [...deltas.keys()])
    if (curErr) return { error: curErr.message }
    for (const v of current ?? []) {
      stockById.set(v.id, v.stock_quantity)
      sizeById.set(v.id, v.size)
    }
    const short = negativeAfterDelta(deltas, stockById)
    if (short.length > 0) {
      const s = short[0]
      return {
        error: `No hay stock para editar: talle ${sizeById.get(s.variant_id) ?? '?'} tiene ${s.current} y se necesitan ${s.needed}. Registrá la compra o ajustá el stock antes de editar.`,
      }
    }
  }

  const { error: updErr } = await supabase
    .from('sales')
    .update({
      customer_id: input.customer_id,
      sale_date: input.sale_date,
      channel: input.channel,
      payment_method: input.payment_method,
      total_amount: total,
      deposit_amount: deposit,
    })
    .eq('id', saleId)
  if (updErr) return { error: updErr.message }

  // Se reemplazan solo los ítems editables: los huérfanos quedan como están.
  const { error: delErr } = await supabase
    .from('sale_items')
    .delete()
    .eq('sale_id', saleId)
    .not('variant_id', 'is', null)
  if (delErr) return { error: `Datos guardados, pero falló actualizar los productos: ${delErr.message}` }

  const { error: insErr } = await supabase.from('sale_items').insert(
    input.items.map(i => {
      const prev = oldByVariant.get(i.variant_id)
      const v = byId.get(i.variant_id)!
      return {
        sale_id: saleId,
        variant_id: i.variant_id,
        // Snapshots: un ítem que ya estaba conserva los suyos para no reescribir
        // el margen ni el nombre histórico. Uno nuevo toma los de hoy.
        product_label: prev
          ? prev.product_label
          : v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: prev ? prev.size_label : v.size,
        unit_cost: prev ? prev.unit_cost : (v.products?.cost_price ?? 0),
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        subtotal: (i.unit_price - i.discount) * i.quantity,
      }
    })
  )
  if (insErr) return { error: `Datos guardados, pero falló insertar los productos: ${insErr.message}` }

  for (const [variantId, delta] of deltas) {
    const current = stockById.get(variantId) ?? 0
    const { error: stockErr } = await supabase
      .from('product_variants')
      .update({ stock_quantity: current + delta })
      .eq('id', variantId)
    if (stockErr) {
      return { error: `Venta actualizada, pero falló ajustar el stock: ${stockErr.message}` }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/encargos')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { movedStock: deltas.size > 0 }
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/sales.ts
git commit -m "feat(ventas): accion updateSale

Edita una venta o encargo sin cambiar su estado. El stock solo se mueve
si la venta esta completada, y por la diferencia entre items viejos y
nuevos. Preserva unit_cost y labels de los items que ya estaban, para no
reescribir el margen historico, y deja intactos los items cuyo producto
se borro del catalogo."
```

---

### Task 5: `SaleForm` en modo edición + página `/ventas/[id]/editar`

**Files:**
- Modify: `src/components/sales/sale-form.tsx`
- Create: `src/app/(dashboard)/ventas/[id]/editar/page.tsx`

**Interfaces:**
- Consumes: `updateSale`, `UpdateSaleInput` (Task 4).
- Produces:
  ```ts
  export interface SaleForEdit {
    id: string
    status: SaleStatus
    sale_date: string
    channel: SaleChannel
    payment_method: PaymentMethod
    customer_id: string | null
    deposit_amount: number
    items: { variant_id: string; quantity: number; unit_price: number; discount: number }[]
    /** Ítems cuyo producto se borró del catálogo. Se conservan sin cambios. */
    orphan: { count: number; total: number }
  }
  ```
  `SaleForm` acepta `sale?: SaleForEdit`.

- [ ] **Step 1: Tipos y props del formulario**

En `src/components/sales/sale-form.tsx`, reemplazar el import de tipos (línea 12):

```tsx
import type { Customer, SaleChannel, SaleStatus, PaymentMethod } from '@/types/database'
```

Agregar el import de la acción de update junto al de `createSale` (línea 6):

```tsx
import { createSale, updateSale } from '@/app/actions/sales'
```

Agregar después de la interfaz `SaleItem` (línea 33):

```tsx
export interface SaleForEdit {
  id: string
  status: SaleStatus
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  deposit_amount: number
  items: { variant_id: string; quantity: number; unit_price: number; discount: number }[]
  /** Ítems cuyo producto se borró del catálogo. Se conservan sin cambios al guardar. */
  orphan: { count: number; total: number }
}
```

- [ ] **Step 2: Estado inicial desde la venta**

Reemplazar la firma del componente y su bloque de `useState` (líneas 35-46):

```tsx
export function SaleForm({
  variants,
  customers,
  sale,
}: {
  variants: VariantOption[]
  customers: Customer[]
  sale?: SaleForEdit
}) {
  const isEdit = !!sale
  const router = useRouter()
  const [items, setItems] = useState<SaleItem[]>(() => {
    if (!sale) return []
    const byId = new Map(variants.map(v => [v.id, v]))
    return sale.items.flatMap(i => {
      const variant = byId.get(i.variant_id)
      return variant
        ? [{ variant, quantity: i.quantity, unit_price: i.unit_price, discount: i.discount }]
        : []
    })
  })
  const [customerId, setCustomerId] = useState(sale?.customer_id ?? '')
  const [channel, setChannel] = useState<string>(sale?.channel ?? 'fisica')
  const [paymentMethod, setPaymentMethod] = useState<string>(sale?.payment_method ?? 'efectivo')
  const [saleDate, setSaleDate] = useState(sale?.sale_date ?? formatDateForInput())
  // En edición el estado no se cambia: esto solo refleja el que ya tiene.
  const [isEncargo, setIsEncargo] = useState(sale ? sale.status === 'encargo' : false)
  const [deposit, setDeposit] = useState(sale?.deposit_amount ?? 0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
```

- [ ] **Step 3: El límite de stock cuenta lo que la venta ya retiene**

Reemplazar el bloque `filteredVariants` (líneas 48-54):

```tsx
  /** Cantidad de cada variante que este registro ya tiene reservada. */
  const originalQty = new Map(sale?.items.map(i => [i.variant_id, i.quantity]) ?? [])

  // Un registro que no retiene stock no tiene tope: un encargo descuenta recién
  // al completarse, y una devolución o cancelada ya repuso o nunca descontó.
  const unlimited = isEncargo || (isEdit && sale.status !== 'completada')

  /**
   * Máximo vendible de una variante. En una venta completada, las unidades que
   * esta misma venta ya descontó vuelven a estar disponibles para ella: sin
   * esto, editar la venta que agotó el último par sería imposible.
   */
  function maxFor(v: VariantOption) {
    return unlimited ? Infinity : v.stock_quantity + (originalQty.get(v.id) ?? 0)
  }

  const filteredVariants = variants.filter(
    v =>
      maxFor(v) > 0 &&
      `${v.brand} ${v.model} ${v.color} ${v.size}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )
```

- [ ] **Step 4: `addItem` y el input de cantidad usan `maxFor`**

Reemplazar `addItem` (líneas 56-71):

```tsx
  function addItem(variant: VariantOption) {
    const existing = items.find(i => i.variant.id === variant.id)
    if (existing) {
      if (existing.quantity >= maxFor(variant)) {
        setError(`Stock insuficiente: solo hay ${maxFor(variant)} ud. de ${variant.brand} ${variant.model} T${variant.size}`)
        return
      }
      setItems(items.map(i =>
        i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setItems([...items, { variant, quantity: 1, unit_price: variant.sale_price, discount: 0 }])
    }
    setSearch('')
    setError(null)
  }
```

Reemplazar el `<Input>` de cantidad de la tabla de ítems (líneas 234-247):

```tsx
                    <Input
                      type="number"
                      min={1}
                      max={unlimited ? undefined : maxFor(item.variant)}
                      value={item.quantity}
                      className="w-16"
                      onChange={e => {
                        const raw = Math.max(1, Number(e.target.value))
                        const qty = Math.min(raw, maxFor(item.variant))
                        setItems(items.map(i =>
                          i.variant.id === item.variant.id ? { ...i, quantity: qty } : i
                        ))
                      }}
                    />
```

- [ ] **Step 5: El total incluye los ítems huérfanos**

Reemplazar la línea del total (línea 88):

```tsx
  const itemsTotal = items.reduce((sum, i) => sum + (i.unit_price - i.discount) * i.quantity, 0)
  const total = itemsTotal + (sale?.orphan.total ?? 0)
```

- [ ] **Step 6: `handleSubmit` llama a update en modo edición**

Reemplazar `handleSubmit` (líneas 90-117):

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    if (!customerId) { setError('Seleccioná un cliente'); return }
    setLoading(true)
    setError(null)

    const payload = {
      sale_date: saleDate,
      channel: channel as 'fisica' | 'online',
      payment_method: paymentMethod as 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago',
      customer_id: customerId,
      items: items.map(i => ({
        variant_id: i.variant.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
    }

    if (isEdit) {
      const { error: updError, movedStock } = await updateSale(sale.id, {
        ...payload,
        deposit_amount: deposit,
      })
      if (updError) { setError(updError); setLoading(false); return }
      toast.success(movedStock ? 'Venta actualizada — stock ajustado' : 'Venta actualizada')
      router.push(sale.status === 'encargo' ? '/encargos' : '/ventas')
      router.refresh()
      return
    }

    const { error: saleError } = await createSale({
      ...payload,
      is_encargo: isEncargo,
      deposit_amount: isEncargo ? deposit : 0,
    })

    if (saleError) { setError(saleError); setLoading(false); return }

    toast.success(isEncargo ? `Encargo registrado — seña ${formatCurrency(deposit)}` : `Venta registrada — ${formatCurrency(total)}`)
    router.push(isEncargo ? '/encargos' : '/ventas')
    router.refresh()
  }
```

- [ ] **Step 7: Ocultar el check de encargo en edición y avisar de los huérfanos**

Reemplazar el bloque del check de encargo (líneas 152-162) por:

```tsx
        {!isEdit && (
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
        )}
```

Justo después del bloque de la seña (después de la línea 175, cerrando el `{isEncargo && (...)}`), agregar el aviso de huérfanos:

```tsx
        {sale && sale.orphan.count > 0 && (
          <p className="sm:col-span-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Esta venta incluye {sale.orphan.count} producto{sale.orphan.count > 1 ? 's' : ''} que ya no está{sale.orphan.count > 1 ? 'n' : ''} en el catálogo,
            por {formatCurrency(sale.orphan.total)}. Se conserva{sale.orphan.count > 1 ? 'n' : ''} sin cambios y suma{sale.orphan.count > 1 ? 'n' : ''} al total.
          </p>
        )}
```

- [ ] **Step 8: El botón acompaña el modo**

Reemplazar el `<Button>` final (líneas 280-288):

```tsx
      <Button
        type="submit"
        disabled={loading || items.length === 0}
        className="w-full py-3"
      >
        {loading
          ? 'Guardando...'
          : isEdit
            ? `Guardar cambios — ${formatCurrency(total)}`
            : isEncargo
              ? `Confirmar encargo — seña ${formatCurrency(deposit)}`
              : `Confirmar venta — ${formatCurrency(total)}`}
      </Button>
```

- [ ] **Step 9: La página de edición**

Crear `src/app/(dashboard)/ventas/[id]/editar/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SaleForm, type VariantOption, type SaleForEdit } from '@/components/sales/sale-form'
import type { SaleChannel, SaleStatus, PaymentMethod } from '@/types/database'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

type SaleItemRow = {
  variant_id: string | null
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}

type SaleRow = {
  id: string
  status: SaleStatus
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  deposit_amount: number
  sale_items: SaleItemRow[]
}

function toOption(v: VariantRow): VariantOption {
  return {
    id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
    brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
    sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
  }
}

export default async function EditarVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: saleData } = await supabase
    .from('sales')
    .select('id, status, sale_date, channel, payment_method, customer_id, deposit_amount, sale_items(variant_id, quantity, unit_price, discount, subtotal)')
    .eq('id', id)
    .single()
  if (!saleData) notFound()
  const sale = saleData as unknown as SaleRow

  const saleVariantIds = sale.sale_items
    .map(i => i.variant_id)
    .filter((v): v is string => v !== null)

  // Las variantes de esta venta se cargan aparte de las activas: el producto
  // pudo desactivarse desde entonces, y sin esto desaparecería de su propia venta.
  const [{ data: activeRows }, { data: saleRows }, { data: customers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    saleVariantIds.length
      ? supabase
          .from('product_variants')
          .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)')
          .in('id', saleVariantIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('customers').select('*').order('name'),
  ])

  const byId = new Map<string, VariantOption>()
  for (const v of ((activeRows as unknown as VariantRow[]) ?? []).filter(v => v.products?.active)) {
    byId.set(v.id, toOption(v))
  }
  for (const v of (saleRows as unknown as VariantRow[]) ?? []) {
    if (v.products) byId.set(v.id, toOption(v))
  }

  const orphans = sale.sale_items.filter(i => !i.variant_id)
  const forEdit: SaleForEdit = {
    id: sale.id,
    status: sale.status,
    sale_date: sale.sale_date,
    channel: sale.channel,
    payment_method: sale.payment_method,
    customer_id: sale.customer_id,
    deposit_amount: sale.deposit_amount,
    items: sale.sale_items
      .filter(i => i.variant_id)
      .map(i => ({
        variant_id: i.variant_id as string,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
    orphan: {
      count: orphans.length,
      total: orphans.reduce((sum, i) => sum + i.subtotal, 0),
    },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {sale.status === 'encargo' ? 'Editar encargo' : 'Editar venta'}
      </h1>
      <SaleForm variants={[...byId.values()]} customers={customers ?? []} sale={forEdit} />
    </div>
  )
}
```

- [ ] **Step 10: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

Manual con `npm run dev`, entrando a mano a `/ventas/<id>/editar` de una venta completada:
- Todos los campos vienen cargados; los productos aparecen en la tabla.
- No hay check de "es encargo".
- Cambiar solo la fecha y guardar → vuelve a `/ventas`, toast "Venta actualizada" (sin "stock ajustado"), y el stock en `/stock` no cambió.
- Subir la cantidad de un ítem en 1 y guardar → toast "Venta actualizada — stock ajustado", el stock bajó exactamente 1.
- `/ventas/nueva` sigue creando igual.

- [ ] **Step 11: Commit**

```bash
git add src/components/sales/sale-form.tsx "src/app/(dashboard)/ventas/[id]/editar/page.tsx"
git commit -m "feat(ventas): pagina de edicion de venta y encargo

SaleForm recibe la venta como prop opcional; sin ella sigue en modo
crear. En edicion el tope de stock suma lo que la venta ya retiene, para
poder editar la venta que agoto el ultimo par, y la pagina carga las
variantes de la venta aparte de las activas para que un producto
desactivado no desaparezca de su propia venta."
```

---

### Task 6: Editar desde ventas y encargos

**Files:**
- Modify: `src/components/sales/sale-row-actions.tsx`
- Modify: `src/components/encargos/encargo-row-actions.tsx`

**Interfaces:**
- Consumes: `RowMenu` con `editHref` (Task 2); la página de Task 5.
- Produces: nada.

- [ ] **Step 1: `SaleRowActions` ofrece Editar**

En `src/components/sales/sale-row-actions.tsx`, reemplazar el bloque `const menu = (...)` (líneas 22-32):

```tsx
  const menu = (
    <RowMenu
      onDelete={del}
      deleteLabel="Eliminar venta"
      confirmDescription={
        status === 'completada'
          ? 'Se borra la venta y las unidades vuelven al stock. No se puede deshacer.'
          : 'Se borra la venta. El stock no se modifica. No se puede deshacer.'
      }
      editHref={`/ventas/${saleId}/editar`}
      editLabel="Editar venta"
    />
  )
```

- [ ] **Step 2: `EncargoRowActions` ofrece Editar**

En `src/components/encargos/encargo-row-actions.tsx`, reemplazar el `<RowMenu>` (líneas 102-106):

```tsx
      <RowMenu
        onDelete={onDelete}
        deleteLabel="Eliminar encargo"
        confirmDescription="Se borra el encargo y la seña deja de contarse en Finanzas. El stock no se modifica. No se puede deshacer."
        editHref={`/ventas/${saleId}/editar`}
        editLabel="Editar encargo"
      />
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

Manual con `npm run dev`:
- En `/ventas`, el menú de 3 puntitos ofrece *Editar venta* y lleva al formulario cargado. *Devolver* sigue en su lugar.
- En `/encargos`, el menú ofrece *Editar encargo*; el formulario muestra la seña y guardarlo vuelve a `/encargos`.
- Editar un encargo (cambiar cantidad o seña) no mueve el stock.

- [ ] **Step 4: Commit**

```bash
git add src/components/sales/sale-row-actions.tsx src/components/encargos/encargo-row-actions.tsx
git commit -m "feat(ventas): opcion Editar en el menu de ventas y encargos"
```

---

### Task 7: Acción `updatePurchase`

**Files:**
- Modify: `src/app/actions/purchases.ts`

**Interfaces:**
- Consumes: `stockDelta`, `negativeAfterDelta` (Task 1).
- Produces:
  ```ts
  export interface UpdatePurchaseInput {
    supplier_id: string
    purchase_date: string
    payment_status: PaymentStatus
    payment_due_date: string | null
    notes: string | null
    items: PurchaseItemInput[]
  }
  export async function updatePurchase(
    purchaseId: string,
    input: UpdatePurchaseInput
  ): Promise<{ error?: string; movedStock?: boolean }>
  ```
  Sin `delivery_status`: es el estado y no se edita. `PurchaseItemInput` ya existe en el archivo (`variant_id`, `quantity`, `unit_cost`).

- [ ] **Step 1: Actualizar el import**

En `src/app/actions/purchases.ts` línea 6, reemplazar:

```ts
import { sumByVariant } from '@/lib/utils/stock-delta'
```

por:

```ts
import { sumByVariant, stockDelta, negativeAfterDelta } from '@/lib/utils/stock-delta'
```

- [ ] **Step 2: Agregar la acción**

Agregar al final de `src/app/actions/purchases.ts`:

```ts
export interface UpdatePurchaseInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  items: PurchaseItemInput[]
}

/**
 * Edita una compra sin cambiar su estado de entrega.
 *
 * El stock se mueve SOLO si la compra está 'recibido', el único estado con
 * unidades sumadas, y por la DIFERENCIA entre los ítems viejos y los nuevos.
 * Bajar una cantidad puede dejar una variante en negativo si esas unidades ya
 * se vendieron: en ese caso se rechaza la edición entera.
 *
 * Los ítems cuyo producto se borró del catálogo (variant_id null) se conservan
 * intactos y siguen sumando al total.
 */
export async function updatePurchase(
  purchaseId: string,
  input: UpdatePurchaseInput
): Promise<{ error?: string; movedStock?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.supplier_id) return { error: 'Seleccioná un proveedor' }
  if (!input.items?.length) return { error: 'Agregá al menos un producto' }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .select('id, delivery_status, purchase_items(variant_id, quantity, unit_cost, product_label, size_label, subtotal)')
    .eq('id', purchaseId)
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'Compra no encontrada' }

  type OldItem = {
    variant_id: string | null
    quantity: number
    unit_cost: number
    product_label: string | null
    size_label: string | null
    subtotal: number
  }
  const row = purchase as unknown as { delivery_status: string; purchase_items: OldItem[] }
  const oldItems = row.purchase_items ?? []
  const oldByVariant = new Map(
    oldItems.filter(i => i.variant_id).map(i => [i.variant_id as string, i])
  )
  const orphanTotal = oldItems
    .filter(i => !i.variant_id)
    .reduce((sum, i) => sum + i.subtotal, 0)

  const ids = [...new Set(input.items.map(i => i.variant_id))]
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity, products(brand, model, color)')
    .in('id', ids)
  if (varErr) return { error: varErr.message }

  type Row = {
    id: string
    size: string
    stock_quantity: number
    products: { brand: string; model: string; color: string } | null
  }
  const byId = new Map((variants as unknown as Row[] ?? []).map(v => [v.id, v]))

  let itemsTotal = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.variant_id)) return { error: 'Uno de los productos ya no existe' }
    itemsTotal += item.unit_cost * item.quantity
  }
  const total = itemsTotal + orphanTotal

  const deltas = row.delivery_status === 'recibido'
    ? stockDelta(oldItems, input.items, 'compra')
    : new Map<string, number>()

  // Validar el stock ANTES de escribir nada.
  const stockById = new Map<string, number>()
  const sizeById = new Map<string, string>()
  if (deltas.size > 0) {
    const { data: current, error: curErr } = await supabase
      .from('product_variants')
      .select('id, size, stock_quantity')
      .in('id', [...deltas.keys()])
    if (curErr) return { error: curErr.message }
    for (const v of current ?? []) {
      stockById.set(v.id, v.stock_quantity)
      sizeById.set(v.id, v.size)
    }
    const short = negativeAfterDelta(deltas, stockById)
    if (short.length > 0) {
      const s = short[0]
      return {
        error: `No se puede guardar: dejaría el talle ${sizeById.get(s.variant_id) ?? '?'} en negativo (stock actual ${s.current}, se intentan restar ${s.needed}). Ajustá el stock antes de editar.`,
      }
    }
  }

  const { error: updErr } = await supabase
    .from('purchases')
    .update({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      total_amount: total,
      payment_status: input.payment_status,
      payment_due_date: input.payment_due_date,
      notes: input.notes,
    })
    .eq('id', purchaseId)
  if (updErr) return { error: updErr.message }

  const { error: delErr } = await supabase
    .from('purchase_items')
    .delete()
    .eq('purchase_id', purchaseId)
    .not('variant_id', 'is', null)
  if (delErr) return { error: `Datos guardados, pero falló actualizar los productos: ${delErr.message}` }

  const { error: insErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => {
      const prev = oldByVariant.get(i.variant_id)
      const v = byId.get(i.variant_id)!
      return {
        purchase_id: purchaseId,
        variant_id: i.variant_id,
        // Snapshots: un ítem que ya estaba conserva el nombre histórico del
        // producto, que pudo renombrarse desde entonces.
        product_label: prev
          ? prev.product_label
          : v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: prev ? prev.size_label : v.size,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity,
      }
    })
  )
  if (insErr) return { error: `Datos guardados, pero falló insertar los productos: ${insErr.message}` }

  for (const [variantId, delta] of deltas) {
    const current = stockById.get(variantId) ?? 0
    const { error: stockErr } = await supabase
      .from('product_variants')
      .update({ stock_quantity: current + delta })
      .eq('id', variantId)
    if (stockErr) {
      return { error: `Compra actualizada, pero falló ajustar el stock: ${stockErr.message}` }
    }
  }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { movedStock: deltas.size > 0 }
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/purchases.ts
git commit -m "feat(compras): accion updatePurchase

Edita una compra sin cambiar su estado de entrega. El stock solo se
mueve si la compra esta recibida, y por la diferencia. Si bajar una
cantidad dejaria stock negativo porque esas unidades ya se vendieron,
rechaza la edicion entera."
```

---

### Task 8: `PurchaseForm` en modo edición + página `/compras/[id]/editar`

**Files:**
- Modify: `src/components/purchases/purchase-form.tsx`
- Create: `src/app/(dashboard)/compras/[id]/editar/page.tsx`
- Read first: `src/app/(dashboard)/compras/nueva/page.tsx` (para copiar cómo carga variantes y proveedores)

**Interfaces:**
- Consumes: `updatePurchase`, `UpdatePurchaseInput` (Task 7).
- Produces:
  ```ts
  export interface PurchaseForEdit {
    id: string
    delivery_status: DeliveryStatus
    supplier_id: string
    purchase_date: string
    payment_status: PaymentStatus
    payment_due_date: string | null
    notes: string | null
    items: { variant_id: string; quantity: number; unit_cost: number }[]
    orphan: { count: number; total: number }
  }
  ```
  `PurchaseForm` acepta `purchase?: PurchaseForEdit`.

- [ ] **Step 1: Tipos y props del formulario**

En `src/components/purchases/purchase-form.tsx`, reemplazar el import de la acción (línea 6) y el de tipos (línea 12):

```tsx
import { createPurchase, updatePurchase } from '@/app/actions/purchases'
```

```tsx
import type { Supplier, PaymentStatus, DeliveryStatus } from '@/types/database'
```

Agregar después de la interfaz `PurchaseItem` (línea 20):

```tsx
export interface PurchaseForEdit {
  id: string
  delivery_status: DeliveryStatus
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  items: { variant_id: string; quantity: number; unit_cost: number }[]
  /** Ítems cuyo producto se borró del catálogo. Se conservan sin cambios al guardar. */
  orphan: { count: number; total: number }
}
```

- [ ] **Step 2: Estado inicial desde la compra**

Reemplazar la firma y el bloque de `useState` (líneas 22-33):

```tsx
export function PurchaseForm({
  variants,
  suppliers,
  purchase,
}: {
  variants: VariantOption[]
  suppliers: Supplier[]
  purchase?: PurchaseForEdit
}) {
  const isEdit = !!purchase
  const router = useRouter()
  const [supplierId, setSupplierId] = useState(purchase?.supplier_id ?? '')
  const [purchaseDate, setPurchaseDate] = useState(purchase?.purchase_date ?? formatDateForInput())
  const [paymentStatus, setPaymentStatus] = useState<string>(purchase?.payment_status ?? 'pendiente')
  // En edición el estado de entrega no se cambia: se usa "Marcar recibida".
  const [deliveryStatus, setDeliveryStatus] = useState<'pedido' | 'recibido'>(
    purchase?.delivery_status ?? 'recibido'
  )
  const [paymentDueDate, setPaymentDueDate] = useState(purchase?.payment_due_date ?? '')
  const [notes, setNotes] = useState(purchase?.notes ?? '')
  const [items, setItems] = useState<PurchaseItem[]>(() => {
    if (!purchase) return []
    const byId = new Map(variants.map(v => [v.id, v]))
    return purchase.items.flatMap(i => {
      const variant = byId.get(i.variant_id)
      return variant ? [{ variant, quantity: i.quantity, unit_cost: i.unit_cost }] : []
    })
  })
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
```

- [ ] **Step 3: El total incluye los huérfanos**

Reemplazar la línea del total (línea 45):

```tsx
  const itemsTotal = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
  const total = itemsTotal + (purchase?.orphan.total ?? 0)
```

- [ ] **Step 4: `handleSubmit` llama a update en modo edición**

Reemplazar `handleSubmit` desde la línea 47 hasta donde termina (leer el archivo para ver el cierre exacto, que incluye el `router.push('/compras')` y el toast):

```tsx
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('Seleccioná un proveedor'); return }
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setLoading(true)
    setError(null)

    const payload = {
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      payment_status: paymentStatus as 'pagado' | 'pendiente' | 'parcial',
      payment_due_date: paymentDueDate || null,
      notes: notes || null,
      items: items.map(i => ({
        variant_id: i.variant.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    }

    if (isEdit) {
      const { error: updError, movedStock } = await updatePurchase(purchase.id, payload)
      if (updError) { setError(updError); setLoading(false); return }
      toast.success(movedStock ? 'Compra actualizada — stock ajustado' : 'Compra actualizada')
      router.push('/compras')
      router.refresh()
      return
    }

    const { error: pErr } = await createPurchase({ ...payload, delivery_status: deliveryStatus })

    if (pErr) { setError(pErr); setLoading(false); return }

    toast.success('Compra registrada — stock actualizado')
    router.push('/compras')
    router.refresh()
  }
```

- [ ] **Step 5: Ocultar el selector de entrega en edición y avisar de los huérfanos**

Leer el JSX del formulario y envolver el bloque del selector de `deliveryStatus` en `{!isEdit && (...)}`, igual que se hizo con el check de encargo en la Task 5. El selector completo (label + `<select>` con las opciones *Pedido* y *Recibido*) queda dentro del condicional.

Agregar, junto a los demás campos de la grilla, el aviso de huérfanos:

```tsx
        {purchase && purchase.orphan.count > 0 && (
          <p className="sm:col-span-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Esta compra incluye {purchase.orphan.count} producto{purchase.orphan.count > 1 ? 's' : ''} que ya no está{purchase.orphan.count > 1 ? 'n' : ''} en el catálogo,
            por {formatCurrency(purchase.orphan.total)}. Se conserva{purchase.orphan.count > 1 ? 'n' : ''} sin cambios y suma{purchase.orphan.count > 1 ? 'n' : ''} al total.
          </p>
        )}
```

- [ ] **Step 6: El botón acompaña el modo**

Leer el `<Button type="submit">` del final del formulario y reemplazar su contenido:

```tsx
        {loading
          ? 'Guardando...'
          : isEdit
            ? `Guardar cambios — ${formatCurrency(total)}`
            : `Registrar compra — ${formatCurrency(total)}`}
```

- [ ] **Step 7: La página de edición**

Crear `src/app/(dashboard)/compras/[id]/editar/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PurchaseForm, type PurchaseForEdit } from '@/components/purchases/purchase-form'
import { type VariantOption } from '@/components/sales/sale-form'
import type { PaymentStatus, DeliveryStatus } from '@/types/database'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

type PurchaseItemRow = {
  variant_id: string | null
  quantity: number
  unit_cost: number
  subtotal: number
}

type PurchaseRow = {
  id: string
  delivery_status: DeliveryStatus
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  purchase_items: PurchaseItemRow[]
}

function toOption(v: VariantRow): VariantOption {
  return {
    id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
    brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
    sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
  }
}

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: purchaseData } = await supabase
    .from('purchases')
    .select('id, delivery_status, supplier_id, purchase_date, payment_status, payment_due_date, notes, purchase_items(variant_id, quantity, unit_cost, subtotal)')
    .eq('id', id)
    .single()
  if (!purchaseData) notFound()
  const purchase = purchaseData as unknown as PurchaseRow

  const purchaseVariantIds = purchase.purchase_items
    .map(i => i.variant_id)
    .filter((v): v is string => v !== null)

  // Igual que en ventas: las variantes de esta compra se cargan aparte de las
  // activas, para que un producto desactivado no desaparezca de su propia compra.
  const [{ data: activeRows }, { data: purchaseRows }, { data: suppliers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    purchaseVariantIds.length
      ? supabase
          .from('product_variants')
          .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)')
          .in('id', purchaseVariantIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('suppliers').select('*').order('name'),
  ])

  const byId = new Map<string, VariantOption>()
  for (const v of ((activeRows as unknown as VariantRow[]) ?? []).filter(v => v.products?.active)) {
    byId.set(v.id, toOption(v))
  }
  for (const v of (purchaseRows as unknown as VariantRow[]) ?? []) {
    if (v.products) byId.set(v.id, toOption(v))
  }

  const orphans = purchase.purchase_items.filter(i => !i.variant_id)
  const forEdit: PurchaseForEdit = {
    id: purchase.id,
    delivery_status: purchase.delivery_status,
    supplier_id: purchase.supplier_id,
    purchase_date: purchase.purchase_date,
    payment_status: purchase.payment_status,
    payment_due_date: purchase.payment_due_date,
    notes: purchase.notes,
    items: purchase.purchase_items
      .filter(i => i.variant_id)
      .map(i => ({
        variant_id: i.variant_id as string,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    orphan: {
      count: orphans.length,
      total: orphans.reduce((sum, i) => sum + i.subtotal, 0),
    },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar compra</h1>
      <PurchaseForm variants={[...byId.values()]} suppliers={suppliers ?? []} purchase={forEdit} />
    </div>
  )
}
```

- [ ] **Step 8: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

Manual con `npm run dev`, entrando a `/compras/<id>/editar`:
- Campos y productos cargados; no aparece el selector de entrega.
- Cambiar solo la fecha en una compra recibida → toast "Compra actualizada", stock sin cambios.
- Subir una cantidad en una compra recibida → toast "Compra actualizada — stock ajustado", el stock subió por la diferencia.
- En una compra en estado *pedido*, cambiar cantidades no toca el stock.
- `/compras/nueva` sigue creando igual.

- [ ] **Step 9: Commit**

```bash
git add src/components/purchases/purchase-form.tsx "src/app/(dashboard)/compras/[id]/editar/page.tsx"
git commit -m "feat(compras): pagina de edicion de compra

PurchaseForm recibe la compra como prop opcional. El selector de entrega
se oculta en edicion: cambiar de pedido a recibido sigue siendo trabajo
del boton Marcar recibida."
```

---

### Task 9: Editar desde compras (y `PurchaseRowActions` al `RowMenu`)

**Files:**
- Modify: `src/components/purchases/purchase-row-actions.tsx`

**Interfaces:**
- Consumes: `RowMenu` con `editHref` (Task 2); la página de Task 8.
- Produces: nada.

- [ ] **Step 1: Migrar del `ConfirmDelete` suelto al `RowMenu`**

Reemplazar `src/components/purchases/purchase-row-actions.tsx` entero:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { receivePurchase, deletePurchase } from '@/app/actions/purchases'
import { RowMenu } from '@/components/common/row-menu'

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
      <RowMenu
        onDelete={onDelete}
        deleteLabel="Eliminar compra"
        confirmDescription={
          deliveryStatus === 'recibido'
            ? 'Se borra la compra y sus unidades se restan del stock. No se puede deshacer.'
            : 'Se borra la compra. El stock no se modifica. No se puede deshacer.'
        }
        editHref={`/compras/${purchaseId}/editar`}
        editLabel="Editar compra"
      />
    </div>
  )
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint`
Expected: sin errores.

Manual en `/compras`: el menú de 3 puntitos ofrece *Editar compra* y *Eliminar compra*; *Marcar recibida* sigue visible en las compras en estado pedido.

- [ ] **Step 3: Commit**

```bash
git add src/components/purchases/purchase-row-actions.tsx
git commit -m "feat(compras): opcion Editar en el menu de la fila

Migra del tacho suelto al RowMenu, que ahora concentra editar y eliminar."
```

---

### Task 10: Unificar catálogo, clientes y proveedores en el `RowMenu`

Cierre de la unificación. Después de esto, `ConfirmDelete` queda sin usarse; `deleteErrorMessage` sí se sigue usando y se muda a `lib/utils`, donde le corresponde por ser una función pura.

**Files:**
- Create: `src/lib/utils/delete-error.ts`
- Delete: `src/components/common/confirm-delete.tsx`
- Modify: `src/components/products/product-row-actions.tsx`
- Modify: `src/app/(dashboard)/clientes/clientes-client.tsx`
- Modify: `src/app/(dashboard)/proveedores/proveedores-client.tsx`
- Modify: `src/components/expenses/expense-row-actions.tsx` (el import de `deleteErrorMessage`)

**Interfaces:**
- Consumes: `RowMenu` con `onEdit` (Task 2).
- Produces: `deleteErrorMessage(error: { code?: string; message: string }): string` pasa a vivir en `@/lib/utils/delete-error`.

- [ ] **Step 1: Mudar `deleteErrorMessage`**

Crear `src/lib/utils/delete-error.ts`:

```ts
/** Mensaje entendible para los errores de Postgres más comunes al borrar. */
export function deleteErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23503') {
    return 'No se puede borrar: hay registros que dependen de este elemento.'
  }
  return error.message
}
```

- [ ] **Step 2: `ProductRowActions` usa el `RowMenu`**

Reemplazar `src/components/products/product-row-actions.tsx` entero:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProductForm } from './product-form'
import { RowMenu } from '@/components/common/row-menu'
import { deleteProduct } from '@/app/actions/products'
import type { Product, Supplier } from '@/types/database'

interface Props {
  product: Product
  suppliers: Pick<Supplier, 'id' | 'name'>[]
}

export function ProductRowActions({ product, suppliers }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function del() {
    const { error } = await deleteProduct(product.id)
    if (error) return { error }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end">
      <RowMenu
        onDelete={del}
        deleteLabel="Eliminar producto"
        onEdit={() => setOpen(true)}
        editLabel="Editar producto"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar producto</DialogTitle>
          </DialogHeader>
          <ProductForm suppliers={suppliers} product={product} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 3: Migrar clientes y proveedores**

En `src/app/(dashboard)/clientes/clientes-client.tsx` y `src/app/(dashboard)/proveedores/proveedores-client.tsx`, en ambos:

1. Sacar el import de `Pencil` de `lucide-react` (línea 5 / 6).
2. Cambiar el import de `confirm-delete` por los dos nuevos:
   ```tsx
   import { RowMenu } from '@/components/common/row-menu'
   import { deleteErrorMessage } from '@/lib/utils/delete-error'
   ```
3. Reemplazar el bloque de acciones de la fila —el `<Dialog>` con el `<DialogTrigger>` del lápiz más el `<ConfirmDelete>` (aprox. líneas 55-75)— siguiendo el patrón de `ProductRowActions` del Step 2: el `<Dialog>` deja de tener `<DialogTrigger>` y pasa a controlarse con `open`/`onOpenChange` desde un `useState`, y el `<RowMenu>` con `onEdit` lo abre.

   El `deleteLabel` y el `editLabel` van en singular y con el sustantivo de cada sección: *"Editar cliente"* / *"Eliminar cliente"*, *"Editar proveedor"* / *"Eliminar proveedor"*. El `<DialogContent>`, su `<DialogHeader>` y el formulario de adentro se dejan tal cual están.

- [ ] **Step 4: Actualizar el import en `ExpenseRowActions`**

En `src/components/expenses/expense-row-actions.tsx`, reemplazar:

```tsx
import { deleteErrorMessage } from '@/components/common/confirm-delete'
```

por:

```tsx
import { deleteErrorMessage } from '@/lib/utils/delete-error'
```

- [ ] **Step 5: Borrar `ConfirmDelete`**

Verificar que ya no lo usa nadie:

Run: `grep -rn "ConfirmDelete\|confirm-delete" src/`
Expected: sin resultados.

```bash
git rm src/components/common/confirm-delete.tsx
```

- [ ] **Step 6: Verificar todo junto**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: tests en verde, sin errores de tipos, sin errores de lint, build exitoso.

Manual con `npm run dev`, recorriendo las cuatro secciones y las tres migradas:
- `/catalogo`, `/clientes`, `/proveedores`: el menú de 3 puntitos ofrece *Editar* y *Eliminar*; ya no hay lápiz ni tacho sueltos. Editar abre el modal como antes.
- `/ventas`, `/encargos`, `/compras`, `/egresos`: mismo menú, editar funciona.
- Los botones de estado (*Devolver*, *Completar entrega*, *Cancelar*, *Marcar recibida*) siguen visibles fuera del menú.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(ui): un solo menu de acciones en toda la app

Catalogo, clientes y proveedores pasan del lapiz y el tacho sueltos al
RowMenu, que queda como unica entrada a editar y eliminar. ConfirmDelete
se borra por quedar sin uso; deleteErrorMessage se muda a lib/utils, que
es donde va una funcion pura."
```

---

## Verificación final

Con el plan completo, estos son los criterios de aceptación del spec y cómo comprobar cada uno:

1. **Editar disponible en las cuatro secciones** → el menú de 3 puntitos ofrece *Editar* en `/ventas`, `/encargos`, `/compras` y `/egresos`.
2. **Corregir la fecha de una venta completada no altera el stock** *(el caso original)* → anotar el stock de un talle, editar solo la fecha, guardar, verificar en `/stock` que quedó igual. El toast dice "Venta actualizada", sin "stock ajustado".
3. **Cambiar cantidades ajusta por la diferencia** → venta completada de 2 unidades con stock 5; pasarla a 3 y guardar deja el stock en 4, no en 2.
4. **Los estados que no retienen no mueven stock** → editar un encargo, una devolución, una venta cancelada y una compra en estado pedido; el stock no cambia en ninguno.
5. **Una edición que dejaría negativo se rechaza entera** → en una compra recibida de 3 unidades cuyas unidades ya se vendieron, bajar la cantidad a 1: aparece el error con el talle y los números, y al recargar la compra sigue con 3.
6. **El margen histórico no cambia** → cambiar el `cost_price` de un producto en el catálogo, después editar la fecha de una venta vieja de ese producto, y verificar en `/reportes` que su margen no se movió.
7. **El formulario de edición no cambia estados** → no hay check de "es encargo" ni selector de entrega en ninguna página de edición.
8. **Crear sigue funcionando** → registrar una venta, una compra y un egreso nuevos.
