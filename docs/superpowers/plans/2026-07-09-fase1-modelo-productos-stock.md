# Fase 1 — Modelo de datos + Productos + Stock — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el modelo actual (una fila de `products` por cada talle) por un modelo producto→variante (`products` = modelo+color+precios; `product_variants` = talle+stock), preservando los datos existentes, arreglando el bug de stock duplicado y habilitando el borrado de productos sin romper el historial.

**Architecture:** Un producto es modelo+color (marca, modelo, color, género, precios, proveedor). Sus talles son filas en `product_variants` (talle + stock). Ventas, compras y ajustes apuntan a `variant_id` (donde vive el stock) y guardan una copia de texto del producto (`product_label`, `size_label`) para que borrar un producto nunca rompa el historial. La UI de catálogo y stock agrupa por producto y muestra el desglose por talle. El alta de un producto carga el stock de cada talle una sola vez (no existe una compra separada que lo duplique).

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), React 19, Supabase (Postgres + RLS), TypeScript, Zod, react-hook-form, Tailwind v4, Vitest (nuevo, solo para lógica pura).

## Global Constraints

- **Next.js es una versión con breaking changes** respecto al conocimiento previo. Antes de tocar patrones de App Router / Server Actions, consultar `node_modules/next/dist/docs/` y respetar avisos de deprecación (regla de `AGENTS.md`).
- **Las migraciones SQL se aplican a mano** en Supabase Dashboard → SQL Editor (no hay CLI de Supabase conectada). La base en vivo **no tiene los triggers** de `002_triggers.sql`: todo el movimiento de stock se hace en el código de las server actions. No aplicar `002_triggers.sql`.
- **RLS activo:** la base en vivo usa el patrón de `0001_rls_policies.sql` (`auth_all` para tablas de negocio: acceso total a usuarios autenticados). Toda tabla nueva debe tener RLS habilitado con la misma política o la app no podrá leerla.
- **Idioma:** todo el texto de UI y mensajes de error va en español rioplatense, igual que el código existente.
- **Rango de talles fijo:** 35 a 45, solo enteros (`['35','36',...,'45']`).
- **Umbral de stock bajo:** 1 par (un talle con `stock_quantity === 1` está "bajo"; `0` es "sin stock").
- **Estilo:** seguir las clases utilitarias y convenciones visuales del código actual (ej. `const sel`, `const lbl`, badges de color emerald/amber/red). No reestructurar componentes fuera del alcance de cada tarea.

---

## Archivos afectados

**Crear:**
- `supabase/migrations/007_product_variants.sql` — migración del modelo (Tarea 3)
- `vitest.config.ts` — config de Vitest (Tarea 1)
- `src/lib/utils/sizes.test.ts` — test del rango de talles (Tarea 1)
- `src/lib/utils/product-groups.ts` — helper de agrupación producto→talles (Tarea 2)
- `src/lib/utils/product-groups.test.ts` — test del helper (Tarea 2)

**Modificar:**
- `src/lib/utils/sizes.ts` — rango fijo 35-45 (Tarea 1)
- `src/types/database.ts` — tipos del nuevo modelo (Tarea 4)
- `src/lib/validations/product.ts` — schema del nuevo form (Tarea 4)
- `src/app/actions/stock.ts` — ajuste por `variant_id` (Tarea 5)
- `src/app/actions/sales.ts` — venta/devolución por `variant_id` + snapshots (Tarea 6)
- `src/app/actions/purchases.ts` — compra por `variant_id` + snapshots (Tarea 7)
- `src/app/actions/products.ts` (nuevo archivo) — crear/editar/borrar producto con variantes (Tarea 8)
- `src/components/products/product-form.tsx` — form con tabla de talles (Tarea 8)
- `src/app/(dashboard)/catalogo/page.tsx` + `catalogo-client.tsx` — vista agrupada (Tarea 9)
- `src/components/products/product-table.tsx` — fila por producto con desglose (Tarea 9)
- `src/components/products/product-row-actions.tsx` — editar/borrar producto (Tarea 9)
- `src/components/common/confirm-delete.tsx` — mensaje de error actualizado (Tarea 9)
- `src/app/(dashboard)/stock/page.tsx` — desde `product_variants` (Tarea 10)
- `src/components/stock/adjustment-form.tsx` + `stock-badge-button.tsx` — ajuste por variante (Tarea 10)
- `src/components/sales/sale-form.tsx` — selección de variante (Tarea 11)
- `src/components/purchases/purchase-form.tsx` — selección de variante (Tarea 11)
- `src/app/(dashboard)/ventas/nueva/page.tsx` + `compras/nueva/page.tsx` — cargar variantes (Tarea 11)
- `src/app/(dashboard)/page.tsx` (dashboard) + `finanzas/page.tsx` + `reportes/page.tsx` — repuntar consultas al nuevo modelo (Tarea 12)
- `src/components/customers/customer-history.tsx` — historial por snapshot (Tarea 12)
- `src/lib/validations/sale.ts` + `purchase.ts` — `variant_id` en los schemas (Tarea 12)

**Nota sobre verificación:** el proyecto no tiene test runner. La Tarea 1 agrega Vitest **solo para lógica pura** (rango de talles, agrupación). Todo lo que toca Supabase, Server Components o UI se verifica con: (a) `npm run build` como gate de tipos/compilación, y (b) correr `npm run dev` y ejercitar el flujo en el navegador contra la base real. No se monta un Supabase de test (fuera de alcance de esta fase).

---

### Task 1: Vitest + rango de talles fijo

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts + devDependency)
- Modify: `src/lib/utils/sizes.ts`
- Test: `src/lib/utils/sizes.test.ts`

**Interfaces:**
- Produces: `SIZE_RANGE: string[]` (constante `['35'..'45']`) y `getSizeRange(): string[]` en `src/lib/utils/sizes.ts`. Se conserva `BRANDS` y `EXPENSE_CATEGORIES` tal cual. Se **elimina** `getSizesForGender` (ya no se usa tras Tarea 8).

- [ ] **Step 1: Instalar Vitest**

Run:
```bash
npm install -D vitest@^2
```
Expected: se agrega `vitest` a `devDependencies` sin errores.

- [ ] **Step 2: Crear config de Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```

- [ ] **Step 3: Agregar script de test**

En `package.json`, dentro de `"scripts"`, agregar la línea `"test": "vitest run"` (dejar las demás igual):
```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run"
  },
```

- [ ] **Step 4: Escribir el test del rango (falla primero)**

Create `src/lib/utils/sizes.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SIZE_RANGE, getSizeRange } from './sizes'

describe('SIZE_RANGE', () => {
  it('va de 35 a 45 inclusive, solo enteros', () => {
    expect(SIZE_RANGE).toEqual(['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'])
  })

  it('getSizeRange devuelve una copia nueva (no la referencia interna)', () => {
    const a = getSizeRange()
    a.push('99')
    expect(SIZE_RANGE).toHaveLength(11)
  })
})
```

- [ ] **Step 5: Correr el test y verificar que falla**

Run: `npm test`
Expected: FALLA — `SIZE_RANGE`/`getSizeRange` no existen aún en `sizes.ts`.

- [ ] **Step 6: Reescribir `sizes.ts`**

Reemplazar el contenido de `src/lib/utils/sizes.ts` por:
```ts
// Rango de talles fijo del negocio: 35 a 45, solo enteros.
export const SIZE_RANGE: string[] = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']

export function getSizeRange(): string[] {
  return [...SIZE_RANGE]
}

export const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse',
  'Vans', 'Fila', 'Reebok', 'Asics', 'Skechers',
]

export const EXPENSE_CATEGORIES = [
  'alquiler', 'servicios', 'marketing', 'delivery',
  'salarios', 'packaging', 'otros',
] as const
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `npm test`
Expected: PASA (2 tests verdes).

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/utils/sizes.ts src/lib/utils/sizes.test.ts
git commit -m "feat: rango de talles fijo 35-45 + setup de Vitest para logica pura"
```

---

### Task 2: Helper de agrupación producto→talles

Este helper toma variantes planas (con datos del producto adjuntos) y las agrupa en "productos" con su desglose por talle, ordenado por número de talle, y con total y mínimo. Lo usan el catálogo (Tarea 9) y stock (Tarea 10).

**Files:**
- Create: `src/lib/utils/product-groups.ts`
- Test: `src/lib/utils/product-groups.test.ts`

**Interfaces:**
- Consumes: `SIZE_RANGE` de `src/lib/utils/sizes.ts` (Tarea 1).
- Produces:
  ```ts
  interface VariantWithProduct {
    id: string            // variant id
    product_id: string
    size: string
    stock_quantity: number
    brand: string
    model: string
    color: string
  }
  interface SizeCell { size: string; qty: number; variantId: string | null }
  interface ProductGroup {
    productId: string
    brand: string
    model: string
    color: string
    sizes: SizeCell[]     // incluye todo SIZE_RANGE (qty 0 si no hay variante) + talles fuera de rango que existan
    totalStock: number
    minStock: number      // mínimo entre talles que existen como variante (Infinity si ninguno)
  }
  function buildProductGroups(variants: VariantWithProduct[]): ProductGroup[]
  ```

- [ ] **Step 1: Escribir el test (falla primero)**

Create `src/lib/utils/product-groups.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildProductGroups, type VariantWithProduct } from './product-groups'

const v = (over: Partial<VariantWithProduct>): VariantWithProduct => ({
  id: 'v1', product_id: 'p1', size: '40', stock_quantity: 1,
  brand: 'Adidas', model: 'Campus', color: 'Total Black', ...over,
})

describe('buildProductGroups', () => {
  it('agrupa variantes del mismo producto y suma el stock total', () => {
    const groups = buildProductGroups([
      v({ id: 'a', size: '39', stock_quantity: 1 }),
      v({ id: 'b', size: '40', stock_quantity: 2 }),
      v({ id: 'c', size: '42', stock_quantity: 3 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].totalStock).toBe(6)
    expect(groups[0].productId).toBe('p1')
  })

  it('rellena los talles faltantes del rango 35-45 con qty 0 y variantId null', () => {
    const groups = buildProductGroups([v({ id: 'a', size: '40', stock_quantity: 2 })])
    const cell41 = groups[0].sizes.find(s => s.size === '41')
    expect(cell41).toEqual({ size: '41', qty: 0, variantId: null })
    const cell40 = groups[0].sizes.find(s => s.size === '40')
    expect(cell40).toEqual({ size: '40', qty: 2, variantId: 'a' })
  })

  it('ordena los talles de menor a mayor', () => {
    const groups = buildProductGroups([
      v({ id: 'a', size: '42' }), v({ id: 'b', size: '39' }),
    ])
    const sizes = groups[0].sizes.map(s => s.size)
    expect(sizes).toEqual(['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'])
  })

  it('incluye talles fuera del rango si existen como variante (datos viejos)', () => {
    const groups = buildProductGroups([v({ id: 'a', size: '46', stock_quantity: 1 })])
    const cell46 = groups[0].sizes.find(s => s.size === '46')
    expect(cell46).toEqual({ size: '46', qty: 1, variantId: 'a' })
  })

  it('minStock es el mínimo entre talles con variante (ignora los rellenados)', () => {
    const groups = buildProductGroups([
      v({ id: 'a', size: '39', stock_quantity: 3 }),
      v({ id: 'b', size: '40', stock_quantity: 1 }),
    ])
    expect(groups[0].minStock).toBe(1)
  })

  it('separa productos distintos (por product_id)', () => {
    const groups = buildProductGroups([
      v({ id: 'a', product_id: 'p1' }),
      v({ id: 'b', product_id: 'p2', model: 'Forum' }),
    ])
    expect(groups).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test src/lib/utils/product-groups.test.ts`
Expected: FALLA — el módulo no existe.

- [ ] **Step 3: Implementar el helper**

Create `src/lib/utils/product-groups.ts`:
```ts
import { SIZE_RANGE } from './sizes'

export interface VariantWithProduct {
  id: string
  product_id: string
  size: string
  stock_quantity: number
  brand: string
  model: string
  color: string
}

export interface SizeCell {
  size: string
  qty: number
  variantId: string | null
}

export interface ProductGroup {
  productId: string
  brand: string
  model: string
  color: string
  sizes: SizeCell[]
  totalStock: number
  minStock: number
}

export function buildProductGroups(variants: VariantWithProduct[]): ProductGroup[] {
  const map = new Map<string, {
    brand: string; model: string; color: string
    bySize: Map<string, { qty: number; variantId: string }>
  }>()

  for (const v of variants) {
    let group = map.get(v.product_id)
    if (!group) {
      group = { brand: v.brand, model: v.model, color: v.color, bySize: new Map() }
      map.set(v.product_id, group)
    }
    group.bySize.set(v.size, { qty: v.stock_quantity, variantId: v.id })
  }

  const result: ProductGroup[] = []
  for (const [productId, group] of map) {
    // Unión del rango fijo + talles que existan fuera de rango, ordenada numéricamente.
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

    result.push({ productId, brand: group.brand, model: group.model, color: group.color, sizes, totalStock, minStock })
  }

  return result.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.color.localeCompare(b.color))
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test src/lib/utils/product-groups.test.ts`
Expected: PASA (6 tests verdes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/product-groups.ts src/lib/utils/product-groups.test.ts
git commit -m "feat: helper buildProductGroups (agrupa variantes por producto con desglose por talle)"
```

---

### Task 3: Migración del modelo de datos (con backup)

Esta es la tarea más delicada: transforma la base en vivo preservando datos. **Requiere backup previo.** Se aplica a mano en Supabase Dashboard → SQL Editor.

**Files:**
- Create: `supabase/migrations/007_product_variants.sql`

**Interfaces:**
- Produces (esquema resultante que consumen las tareas 4-11):
  - `products`: `id, brand, model, color, gender (nullable), cost_price, sale_price, discount_price?, image_url?, description?, supplier_id, active, created_at` — **sin** `size`, `stock_quantity`, `sku`.
  - `product_variants`: `id, product_id, size, stock_quantity, sku (nullable), created_at`, único `(product_id, size)`, `on delete cascade` desde products.
  - `sale_items`: `id, sale_id, variant_id (nullable, on delete set null), quantity, unit_price, discount, subtotal, product_label, size_label` — **sin** `product_id`.
  - `purchase_items`: `id, purchase_id, variant_id (nullable, on delete set null), quantity, unit_cost, subtotal, product_label, size_label` — **sin** `product_id`.
  - `stock_adjustments`: `id, variant_id (on delete cascade), quantity_change, reason, notes, created_by, created_at` — **sin** `product_id`.

- [ ] **Step 1: Hacer backup de la base**

En Supabase Dashboard → Database → Backups, crear un backup manual (o Database → Backups → "Restore to a new project" disponible como plan B). Confirmar que el backup existe y anotó fecha/hora antes de continuar.

> Si no hay backup automático disponible en el plan, exportar al menos las tablas afectadas: Dashboard → SQL Editor → correr `select * from products;`, `sale_items`, `purchase_items`, `stock_adjustments` y guardar los CSV con el botón de export. **No continuar sin un respaldo.**

- [ ] **Step 2: Contar filas antes de migrar (para verificar después)**

En SQL Editor correr y **anotar** los resultados:
```sql
select
  (select count(*) from products) as products,
  (select count(distinct (brand, model, color, gender)) from products) as grupos,
  (select count(*) from sale_items) as sale_items,
  (select count(*) from purchase_items) as purchase_items,
  (select count(*) from stock_adjustments) as stock_adjustments;
```
Expected: anotar los 5 números. Tras migrar: `product_variants` debe tener = `products` (viejo); `products` nuevo debe tener = `grupos`; los counts de items/adjustments no cambian.

- [ ] **Step 3: Escribir la migración**

Create `supabase/migrations/007_product_variants.sql`:
```sql
-- =============================================================================
-- 007_product_variants.sql — Rediseño Fase 1
-- Separa products (modelo+color) de product_variants (talle+stock).
-- Preserva datos. APLICAR UNA SOLA VEZ. Requiere backup previo.
-- Aplicar en Supabase Dashboard -> SQL Editor.
-- =============================================================================

begin;

-- 1) Tabla de variantes (talle + stock). legacy_product_id es temporal.
create table product_variants (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete cascade,
  size text not null,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  sku text,
  legacy_product_id uuid,
  created_at timestamptz default now()
);

-- 2) Columna temporal para agrupar filas de products por modelo+color+genero.
alter table products add column parent_id uuid;

-- 3) Fila canonica por grupo = menor id (determinista).
update products p
set parent_id = sub.canonical_id
from (
  select brand, model, color, gender, min(id::text)::uuid as canonical_id
  from products
  group by brand, model, color, gender
) sub
where p.brand = sub.brand and p.model = sub.model
  and p.color = sub.color and p.gender is not distinct from sub.gender;

-- 4) Una variante por cada fila de products, colgando del canonico.
insert into product_variants (product_id, size, stock_quantity, sku, legacy_product_id)
select parent_id, size, stock_quantity, sku, id
from products;

-- 5) Snapshots + repunte de sale_items a variant_id (ANTES de borrar filas).
alter table sale_items add column variant_id uuid;
alter table sale_items add column product_label text;
alter table sale_items add column size_label text;

update sale_items si
set variant_id = v.id,
    product_label = p.brand || ' ' || p.model || ' ' || p.color,
    size_label = p.size
from products p
join product_variants v on v.legacy_product_id = p.id
where si.product_id = p.id;

-- 6) Idem purchase_items.
alter table purchase_items add column variant_id uuid;
alter table purchase_items add column product_label text;
alter table purchase_items add column size_label text;

update purchase_items pi
set variant_id = v.id,
    product_label = p.brand || ' ' || p.model || ' ' || p.color,
    size_label = p.size
from products p
join product_variants v on v.legacy_product_id = p.id
where pi.product_id = p.id;

-- 7) Idem stock_adjustments.
alter table stock_adjustments add column variant_id uuid;

update stock_adjustments sa
set variant_id = v.id
from product_variants v
where v.legacy_product_id = sa.product_id;

-- 8) Borrar filas de products no canonicas (ahora representadas como variantes).
delete from products where id <> parent_id;

-- 9) Reapuntar FKs y limpiar columnas viejas.
alter table sale_items drop constraint sale_items_product_id_fkey;
alter table sale_items add constraint sale_items_variant_id_fkey
  foreign key (variant_id) references product_variants(id) on delete set null;
alter table sale_items drop column product_id;

alter table purchase_items drop constraint purchase_items_product_id_fkey;
alter table purchase_items add constraint purchase_items_variant_id_fkey
  foreign key (variant_id) references product_variants(id) on delete set null;
alter table purchase_items drop column product_id;

alter table stock_adjustments drop constraint stock_adjustments_product_id_fkey;
alter table stock_adjustments add constraint stock_adjustments_variant_id_fkey
  foreign key (variant_id) references product_variants(id) on delete cascade;
alter table stock_adjustments alter column variant_id set not null;
alter table stock_adjustments drop column product_id;

-- 10) Limpiar products: quitar columnas que ahora viven en la variante.
alter table products drop column size;
alter table products drop column stock_quantity;
alter table products drop column sku;
alter table products drop column parent_id;
alter table products alter column gender drop not null;

-- 11) Finalizar product_variants.
alter table product_variants drop column legacy_product_id;
alter table product_variants add constraint product_variants_unique_size unique (product_id, size);
create index idx_product_variants_product on product_variants(product_id);

-- 12) RLS para la tabla nueva (mismo patron auth_all que las demas tablas de negocio).
alter table product_variants enable row level security;
drop policy if exists "auth_all_product_variants" on product_variants;
create policy "auth_all_product_variants" on product_variants
  for all to authenticated using (true) with check (true);

commit;
```

- [ ] **Step 4: Aplicar la migración**

Copiar el contenido de `007_product_variants.sql` en Supabase Dashboard → SQL Editor → Run.
Expected: "Success. No rows returned". Si algo falla, la transacción hace rollback completo (todo el script está en `begin/commit`); revisar el error y no continuar hasta resolverlo.

- [ ] **Step 5: Verificar la migración con SQL**

Correr y comparar contra lo anotado en Step 2:
```sql
select
  (select count(*) from products) as products_nuevo,          -- debe = grupos
  (select count(*) from product_variants) as variants,        -- debe = products viejo
  (select count(*) from sale_items where variant_id is null and product_label is null) as sale_items_huerfanos,   -- debe = 0
  (select count(*) from purchase_items where variant_id is null and product_label is null) as purchase_huerfanos, -- debe = 0
  (select count(*) from stock_adjustments where variant_id is null) as adj_huerfanos;                              -- debe = 0
```
Expected: `products_nuevo` = `grupos` de Step 2; `variants` = `products` de Step 2; los tres contadores de huérfanos = 0.

- [ ] **Step 6: Verificar integridad de un producto conocido**

```sql
select p.brand, p.model, p.color,
       sum(v.stock_quantity) as stock_total,
       count(v.id) as talles
from products p
join product_variants v on v.product_id = p.id
group by p.id, p.brand, p.model, p.color
order by p.brand, p.model
limit 10;
```
Expected: cada producto aparece UNA vez con su stock total y cantidad de talles. Comparar el stock total de algún modelo contra lo que mostraba la app antes de migrar.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/007_product_variants.sql
git commit -m "feat: migracion 007 - modelo producto/variante con preservacion de datos"
```

---

### Task 4: Tipos TypeScript + validación del producto

Actualiza los tipos para el nuevo esquema. Tras esta tarea el proyecto **no compila** hasta terminar las tareas 5-11 (los tipos viejos desaparecen); es esperado. El gate de esta tarea es acotado a los archivos tocados.

**Files:**
- Modify: `src/types/database.ts`
- Modify: `src/lib/validations/product.ts`

**Interfaces:**
- Produces:
  - `Product` sin `size`/`stock_quantity`/`sku`; con `discount_price?`, `image_url?`, `description?`; `gender` ahora `Gender | null`; opcional `variants?: ProductVariant[]`.
  - `ProductVariant { id, product_id, size, stock_quantity, sku: string | null, created_at, products?: Product }`.
  - `SaleItem` y `PurchaseItem` con `variant_id: string | null`, `product_label: string | null`, `size_label: string | null`, sin `product_id`; opcional `variant?: ProductVariant`.
  - `StockAdjustment` con `variant_id: string` (sin `product_id`); opcional `variant?: ProductVariant`.
  - `ProductFormData` (Zod): `brand, model, color, gender?, cost_price, sale_price, supplier_id?, active, variants: { size: string; stock_quantity: number }[]`.

- [ ] **Step 1: Actualizar `Product`, agregar `ProductVariant`**

En `src/types/database.ts`, reemplazar la interfaz `Product` (líneas 22-37 del original) por:
```ts
export interface Product {
  id: string
  brand: string
  model: string
  color: string
  gender: Gender | null
  cost_price: number
  sale_price: number
  discount_price: number | null
  image_url: string | null
  description: string | null
  supplier_id: string | null
  active: boolean
  created_at: string
  suppliers?: Supplier
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: string
  product_id: string
  size: string
  stock_quantity: number
  sku: string | null
  created_at: string
  products?: Product
}
```

- [ ] **Step 2: Actualizar `SaleItem`, `PurchaseItem`, `StockAdjustment`**

Reemplazar `SaleItem` (líneas 64-73 del original) por:
```ts
export interface SaleItem {
  id: string
  sale_id: string
  variant_id: string | null
  product_label: string | null
  size_label: string | null
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
  variant?: ProductVariant
}
```
Reemplazar `PurchaseItem` (líneas 89-97) por:
```ts
export interface PurchaseItem {
  id: string
  purchase_id: string
  variant_id: string | null
  product_label: string | null
  size_label: string | null
  quantity: number
  unit_cost: number
  subtotal: number
  variant?: ProductVariant
}
```
Reemplazar `StockAdjustment` (líneas 113-122) por:
```ts
export interface StockAdjustment {
  id: string
  variant_id: string
  quantity_change: number
  reason: AdjustmentReason
  notes: string | null
  created_by: string | null
  created_at: string
  variant?: ProductVariant
}
```

- [ ] **Step 3: Actualizar el bloque `Database` (tipos del cliente Supabase)**

En el objeto `Database.public.Tables`:
- En `products`, cambiar las tres líneas a:
  ```ts
      products: {
        Row: Omit<Product, 'suppliers' | 'variants'>
        Insert: Omit<Product, 'id' | 'created_at' | 'suppliers' | 'variants'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'suppliers' | 'variants'>>
        Relationships: []
      }
  ```
- Agregar una entrada nueva `product_variants` (después de `products`):
  ```ts
      product_variants: {
        Row: Omit<ProductVariant, 'products'>
        Insert: Omit<ProductVariant, 'id' | 'created_at' | 'products'>
        Update: Partial<Omit<ProductVariant, 'id' | 'created_at' | 'products'>>
        Relationships: []
      }
  ```
- En `sale_items`, cambiar a `Row: Omit<SaleItem, 'variant'>`, `Insert: Omit<SaleItem, 'id' | 'variant'>`, `Update: Partial<Omit<SaleItem, 'id' | 'variant'>>`.
- En `purchase_items`, cambiar a `Row: Omit<PurchaseItem, 'variant'>`, `Insert: Omit<PurchaseItem, 'id' | 'variant'>`, `Update: Partial<Omit<PurchaseItem, 'id' | 'variant'>>`.
- En `stock_adjustments`, cambiar a `Row: Omit<StockAdjustment, 'variant'>`, `Insert: Omit<StockAdjustment, 'id' | 'created_at' | 'variant'>`, `Update: Partial<Omit<StockAdjustment, 'id' | 'created_at' | 'variant'>>`.

> Nota: el tipo `Relationships` puede simplificarse a `[]` como arriba; si preferís, dejá el shape anterior — no afecta el runtime.

- [ ] **Step 4: Reescribir la validación del producto**

Reemplazar el contenido de `src/lib/validations/product.ts` por:
```ts
import { z } from 'zod'

export const productVariantSchema = z.object({
  size: z.string().min(1),
  stock_quantity: z.number().int('Debe ser entero').min(0, 'No puede ser negativo'),
})

export const productSchema = z.object({
  brand: z.string().min(1, 'Requerido'),
  model: z.string().min(1, 'Requerido'),
  color: z.string().min(1, 'Requerido'),
  gender: z.enum(['hombre', 'mujer', 'nino', 'unisex']).optional().nullable(),
  cost_price: z.number().min(0, 'Debe ser positivo'),
  sale_price: z.number().min(0, 'Debe ser positivo'),
  supplier_id: z.string().optional().nullable(),
  active: z.boolean(),
  variants: z.array(productVariantSchema),
})

export type ProductFormData = z.infer<typeof productSchema>
export type ProductVariantInput = z.infer<typeof productVariantSchema>
```

- [ ] **Step 5: Verificar tipos de los archivos tocados**

Run: `npx tsc --noEmit src/types/database.ts src/lib/validations/product.ts 2>&1 | head -20`
Expected: sin errores en esos dos archivos (puede haber errores en OTROS archivos que aún no migramos — eso es esperado; se resuelve en tareas siguientes). Confirmar que los errores restantes NO están en `database.ts` ni `validations/product.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/types/database.ts src/lib/validations/product.ts
git commit -m "feat: tipos y validacion del modelo producto/variante"
```

---

### Task 5: Server action de ajuste de stock (por variante)

**Files:**
- Modify: `src/app/actions/stock.ts`

**Interfaces:**
- Consumes: `product_variants` (Tarea 3).
- Produces: `adjustStock(variantId: string, change: number, reason: string, notes: string): Promise<{ error?: string }>` — misma firma pero el primer parámetro ahora es `variantId`.

- [ ] **Step 1: Reescribir `stock.ts`**

Reemplazar el contenido de `src/app/actions/stock.ts` por:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const adjustmentSchema = z.object({
  variantId: z.string().uuid(),
  change: z.number().int().refine(n => n !== 0, 'El cambio debe ser distinto de 0'),
  reason: z.enum(['ajuste_manual', 'rotura', 'perdida', 'devolucion_proveedor']),
  notes: z.string().max(500),
})

/**
 * Ajusta el stock de una variante (talle) y deja registro en stock_adjustments.
 * El movimiento de stock se hace acá (la base en vivo no tiene triggers).
 */
export async function adjustStock(
  variantId: string,
  change: number,
  reason: string,
  notes: string
): Promise<{ error?: string }> {
  const parsed = adjustmentSchema.safeParse({ variantId, change, reason, notes })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: variant, error: fetchError } = await supabase
    .from('product_variants')
    .select('stock_quantity')
    .eq('id', parsed.data.variantId)
    .single()

  if (fetchError || !variant) return { error: 'Talle no encontrado' }

  const newQty = variant.stock_quantity + parsed.data.change
  if (newQty < 0) return { error: `Stock insuficiente. Actual: ${variant.stock_quantity}` }

  const { error: updateError } = await supabase
    .from('product_variants')
    .update({ stock_quantity: newQty })
    .eq('id', parsed.data.variantId)

  if (updateError) return { error: updateError.message }

  const { error: insertError } = await supabase.from('stock_adjustments').insert({
    variant_id: parsed.data.variantId,
    quantity_change: parsed.data.change,
    reason: parsed.data.reason,
    notes: parsed.data.notes || null,
    created_by: user.id,
  })

  if (insertError) return { error: insertError.message }

  revalidatePath('/stock')
  revalidatePath('/catalogo')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 2: Verificar compilación del archivo**

Run: `npx tsc --noEmit 2>&1 | grep "actions/stock.ts" | head`
Expected: sin líneas (ningún error en `actions/stock.ts`). Errores en otros archivos aún esperados.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/stock.ts
git commit -m "feat: adjustStock opera por variant_id"
```

---

### Task 6: Server action de ventas (por variante + snapshots)

**Files:**
- Modify: `src/app/actions/sales.ts`

**Interfaces:**
- Consumes: `product_variants`, `sale_items` con snapshots (Tarea 3).
- Produces:
  - `createSale(input)` donde `input.items: { variant_id: string; quantity: number; unit_price: number; discount: number }[]`.
  - `returnSale(saleId: string)` — repone stock por `variant_id`.

- [ ] **Step 1: Reescribir `sales.ts`**

Reemplazar el contenido de `src/app/actions/sales.ts` por:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentMethod, SaleChannel } from '@/types/database'

interface SaleItemInput {
  variant_id: string
  quantity: number
  unit_price: number
  discount: number
}

interface CreateSaleInput {
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  items: SaleItemInput[]
}

/**
 * Registra una venta: valida stock/existencia contra la base, inserta la venta
 * y sus items (con snapshot de nombre y talle), y descuenta el stock por variante.
 */
export async function createSale(input: CreateSaleInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.items?.length) return { error: 'Agregá al menos un producto' }
  if (!input.customer_id) return { error: 'Seleccioná un cliente' }

  const ids = [...new Set(input.items.map(i => i.variant_id))]
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity, products(active, brand, model, color)')
    .in('id', ids)
  if (varErr) return { error: varErr.message }

  type Row = {
    id: string; size: string; stock_quantity: number
    products: { active: boolean; brand: string; model: string; color: string } | null
  }
  const byId = new Map((variants as Row[] ?? []).map(v => [v.id, v]))

  const qtyById = new Map<string, number>()
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
  }

  let total = 0
  for (const item of input.items) {
    const v = byId.get(item.variant_id)
    if (!v || !v.products?.active) return { error: 'Uno de los productos no existe o está inactivo' }
    total += (item.unit_price - item.discount) * item.quantity
  }
  for (const [variantId, qty] of qtyById) {
    const v = byId.get(variantId)!
    if (qty > v.stock_quantity) {
      return { error: `Stock insuficiente (disponible: ${v.stock_quantity}). Actualizá la página y reintentá.` }
    }
  }

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      customer_id: input.customer_id,
      sale_date: input.sale_date,
      channel: input.channel,
      payment_method: input.payment_method,
      total_amount: total,
      status: 'completada',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (saleError || !sale) return { error: saleError?.message ?? 'No se pudo registrar la venta' }

  const { error: itemsError } = await supabase.from('sale_items').insert(
    input.items.map(i => {
      const v = byId.get(i.variant_id)!
      return {
        sale_id: sale.id,
        variant_id: i.variant_id,
        product_label: v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: v.size,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        subtotal: (i.unit_price - i.discount) * i.quantity,
      }
    })
  )
  if (itemsError) {
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: itemsError.message }
  }

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

  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/**
 * Marca una venta completada como devolución y repone el stock de sus items.
 * El update condicionado por status evita reponer dos veces.
 */
export async function returnSale(saleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, sale_items(variant_id, quantity)')
    .eq('id', saleId)
    .single()
  if (saleErr || !sale) return { error: saleErr?.message ?? 'Venta no encontrada' }
  if (sale.status !== 'completada') return { error: 'Solo se pueden devolver ventas completadas' }

  const { data: updated, error: updErr } = await supabase
    .from('sales')
    .update({ status: 'devolucion' })
    .eq('id', saleId)
    .eq('status', 'completada')
    .select('id')
  if (updErr) return { error: updErr.message }
  if (!updated?.length) return { error: 'La venta ya fue devuelta o cancelada' }

  const qtyById = new Map<string, number>()
  for (const item of (sale.sale_items ?? []) as { variant_id: string | null; quantity: number }[]) {
    if (!item.variant_id) continue
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
  }

  if (qtyById.size > 0) {
    const { data: variants, error: varErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', [...qtyById.keys()])
    if (varErr) {
      return { error: `Venta marcada como devolución, pero falló leer el stock: ${varErr.message}` }
    }
    for (const v of variants ?? []) {
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: v.stock_quantity + (qtyById.get(v.id) ?? 0) })
        .eq('id', v.id)
      if (stockErr) {
        return { error: `Venta devuelta, pero falló reponer el stock: ${stockErr.message}` }
      }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 2: Verificar compilación del archivo**

Run: `npx tsc --noEmit 2>&1 | grep "actions/sales.ts" | head`
Expected: sin líneas.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/sales.ts
git commit -m "feat: ventas por variant_id con snapshot de producto y talle"
```

---

### Task 7: Server action de compras (por variante + snapshots)

**Files:**
- Modify: `src/app/actions/purchases.ts`

**Interfaces:**
- Consumes: `product_variants`, `purchase_items` con snapshots (Tarea 3).
- Produces: `createPurchase(input)` donde `input.items: { variant_id: string; quantity: number; unit_cost: number }[]`.

- [ ] **Step 1: Reescribir `purchases.ts`**

Reemplazar el contenido de `src/app/actions/purchases.ts` por:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus } from '@/types/database'

interface PurchaseItemInput {
  variant_id: string
  quantity: number
  unit_cost: number
}

interface CreatePurchaseInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  items: PurchaseItemInput[]
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
  const byId = new Map((variants as Row[] ?? []).map(v => [v.id, v]))

  const qtyById = new Map<string, number>()
  let total = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.variant_id)) return { error: 'Uno de los productos no existe' }
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
    total += item.unit_cost * item.quantity
  }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .insert({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      total_amount: total,
      payment_status: input.payment_status,
      payment_due_date: input.payment_due_date,
      notes: input.notes,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'No se pudo registrar la compra' }

  const { error: iErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => {
      const v = byId.get(i.variant_id)!
      return {
        purchase_id: purchase.id,
        variant_id: i.variant_id,
        product_label: v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: v.size,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity,
      }
    })
  )
  if (iErr) {
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: iErr.message }
  }

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

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 2: Verificar compilación del archivo**

Run: `npx tsc --noEmit 2>&1 | grep "actions/purchases.ts" | head`
Expected: sin líneas.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/purchases.ts
git commit -m "feat: compras por variant_id con snapshot de producto y talle"
```

---

### Task 8: Alta/edición de producto con tabla de talles

Un solo formulario crea/edita el producto (modelo+color+precios) y todos sus talles a la vez. El alta carga el stock de cada talle una sola vez — no hay compra separada (arregla el bug de stock 2).

**Files:**
- Create: `src/app/actions/products.ts`
- Modify: `src/components/products/product-form.tsx`

**Interfaces:**
- Consumes: `productSchema`/`ProductFormData` (Tarea 4), `SIZE_RANGE` (Tarea 1), `adjustStock` (Tarea 5).
- Produces (en `src/app/actions/products.ts`):
  - `createProduct(input: ProductInput): Promise<{ error?: string }>`
  - `updateProduct(productId: string, input: ProductInput): Promise<{ error?: string }>`
  - `deleteProduct(productId: string): Promise<{ error?: string }>`
  - Tipo `ProductInput = { brand, model, color, gender: string | null, cost_price, sale_price, supplier_id: string | null, active, variants: { size: string; stock_quantity: number }[] }`.

- [ ] **Step 1: Crear las server actions de producto**

Create `src/app/actions/products.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface ProductInput {
  brand: string
  model: string
  color: string
  gender: string | null
  cost_price: number
  sale_price: number
  supplier_id: string | null
  active: boolean
  variants: { size: string; stock_quantity: number }[]
}

function productFields(input: ProductInput) {
  return {
    brand: input.brand,
    model: input.model,
    color: input.color,
    gender: input.gender,
    cost_price: input.cost_price,
    sale_price: input.sale_price,
    supplier_id: input.supplier_id,
    active: input.active,
  }
}

/** Crea el producto y una variante por cada talle con stock > 0. */
export async function createProduct(input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

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
    const { error: vErr } = await supabase.from('product_variants').insert(variants)
    if (vErr) {
      await supabase.from('products').delete().eq('id', product.id)
      return { error: vErr.message }
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/**
 * Edita el producto y sincroniza sus talles: crea los que aparecen, borra los
 * que quedan en 0 sin historial, y ajusta el stock de los existentes dejando
 * registro (stock_adjustments) en vez de pisarlo.
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

  for (const wanted of input.variants) {
    const current = bySize.get(wanted.size)
    if (!current) {
      if (wanted.stock_quantity > 0) {
        const { error: insErr } = await supabase
          .from('product_variants')
          .insert({ product_id: productId, size: wanted.size, stock_quantity: wanted.stock_quantity })
        if (insErr) return { error: insErr.message }
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
      const { error: adjErr } = await supabase.from('stock_adjustments').insert({
        variant_id: current.id,
        quantity_change: delta,
        reason: 'ajuste_manual',
        notes: 'Corrección desde catálogo',
        created_by: user.id,
      })
      if (adjErr) return { error: adjErr.message }
    }
    bySize.delete(wanted.size)
  }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/** Borra el producto. Sus variantes caen por cascade; el historial de ventas/
 *  compras conserva el snapshot (product_label/size_label) y queda intacto. */
export async function deleteProduct(productId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) return { error: error.message }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
```

- [ ] **Step 2: Reescribir el formulario de producto**

Reemplazar el contenido de `src/components/products/product-form.tsx` por:
```tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { productSchema, type ProductFormData } from '@/lib/validations/product'
import { SIZE_RANGE } from '@/lib/utils/sizes'
import { BRANDS } from '@/lib/utils/sizes'
import { createProduct, updateProduct } from '@/app/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product, Supplier } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50'
const lbl = 'font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]'

interface ProductFormProps {
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  product?: Product
  onSuccess?: () => void
}

export function ProductForm({ suppliers, product, onSuccess }: ProductFormProps) {
  const router = useRouter()
  const editing = !!product

  // Talles a mostrar: rango fijo + los que ya existan fuera de rango (datos viejos).
  const existingSizes = product?.variants?.map(v => v.size) ?? []
  const sizes = [...new Set([...SIZE_RANGE, ...existingSizes])].sort((a, b) => Number(a) - Number(b))
  const stockBySize: Record<string, number> = {}
  for (const v of product?.variants ?? []) stockBySize[v.size] = v.stock_quantity

  const [error, setError] = useState<string | null>(null)
  const [stock, setStock] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const s of sizes) init[s] = stockBySize[s] ?? 0
    return init
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          brand: product.brand, model: product.model, color: product.color,
          gender: product.gender ?? undefined,
          cost_price: product.cost_price, sale_price: product.sale_price,
          supplier_id: product.supplier_id ?? undefined, active: product.active,
          variants: [],
        }
      : { active: true, variants: [] },
  })

  const totalStock = Object.values(stock).reduce((a, b) => a + b, 0)

  async function onSubmit(data: ProductFormData) {
    setError(null)
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className={lbl}>Marca</Label>
          <select {...register('brand')} className={sel}>
            <option value="" className="bg-card">Seleccionar</option>
            {BRANDS.map(b => <option key={b} value={b} className="bg-card">{b}</option>)}
          </select>
          {errors.brand && <p className="text-xs text-red-600 dark:text-red-400">{errors.brand.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Modelo</Label>
          <Input {...register('model')} placeholder="Campus" />
          {errors.model && <p className="text-xs text-red-600 dark:text-red-400">{errors.model.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Color</Label>
          <Input {...register('color')} placeholder="Total Black" />
          {errors.color && <p className="text-xs text-red-600 dark:text-red-400">{errors.color.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Proveedor</Label>
          <select {...register('supplier_id')} className={sel}>
            <option value="" className="bg-card">Sin proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Costo ($)</Label>
          <Input {...register('cost_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.cost_price && <p className="text-xs text-red-600 dark:text-red-400">{errors.cost_price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Precio de venta ($)</Label>
          <Input {...register('sale_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.sale_price && <p className="text-xs text-red-600 dark:text-red-400">{errors.sale_price.message}</p>}
        </div>
      </div>

      {/* Tabla de talles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={lbl}>Stock por talle</Label>
          <span className="text-xs text-foreground/55">Total: <span className="font-mono font-semibold text-foreground tabular-nums">{totalStock}</span></span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {sizes.map(size => (
            <div key={size} className="space-y-1">
              <span className="block text-center text-[10px] text-foreground/45">T{size}</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={stock[size] ?? 0}
                onChange={e => setStock(prev => ({ ...prev, [size]: Math.max(0, Number(e.target.value)) }))}
                className="text-center px-1"
              />
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <label className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer hover:text-foreground transition-colors">
          <input type="checkbox" {...register('active')} className="rounded" />
          Producto activo (desactivalo para ocultarlo sin borrarlo)
        </label>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar producto'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Verificar compilación de los archivos**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions/products.ts|product-form.tsx" | head`
Expected: sin líneas.

- [ ] **Step 4: Commit**

```bash
git add src/app/actions/products.ts src/components/products/product-form.tsx
git commit -m "feat: alta/edicion de producto con tabla de talles (stock cargado una sola vez)"
```

---

### Task 9: Catálogo agrupado por producto + borrado

El catálogo muestra una fila por producto (modelo+color) con su stock total y desglose por talle. El botón eliminar usa `deleteProduct` y funciona siempre.

**Files:**
- Modify: `src/app/(dashboard)/catalogo/page.tsx`
- Modify: `src/app/(dashboard)/catalogo/catalogo-client.tsx`
- Modify: `src/components/products/product-table.tsx`
- Modify: `src/components/products/product-row-actions.tsx`
- Modify: `src/components/common/confirm-delete.tsx`

**Interfaces:**
- Consumes: `Product` con `variants` (Tarea 4), `deleteProduct` (Tarea 8), `buildProductGroups` no se usa acá (el catálogo ya trae variantes anidadas por producto).

- [ ] **Step 1: Cargar productos con variantes en la page**

Reemplazar el `select` de products en `src/app/(dashboard)/catalogo/page.tsx` (línea 11) por uno que traiga variantes y proveedor:
```ts
    supabase
      .from('products')
      .select('*, suppliers(name), variants:product_variants(*)')
      .order('brand')
      .order('model'),
```
(El resto del archivo queda igual.)

- [ ] **Step 2: Actualizar el buscador del catálogo**

En `src/components/catalogo/catalogo-client.tsx` … (ruta real: `src/app/(dashboard)/catalogo/catalogo-client.tsx`), reemplazar el filtro `filtered` (líneas 25-31) por uno que no dependa de `sku`/`size` (ya no existen en product):
```tsx
  const filtered = search
    ? products.filter(p =>
        `${p.brand} ${p.model} ${p.color}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : products
```
Y cambiar el texto del contador (línea ~39) de `{filtered.length} de {products.length} SKUs` a `{filtered.length} de {products.length} productos`. Cambiar el placeholder del input (línea ~47) a `"Buscar por marca, modelo o color..."`.

- [ ] **Step 3: Reescribir la tabla de productos**

Reemplazar el contenido de `src/components/products/product-table.tsx` por:
```tsx
import type { Product, Supplier } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { ProductRowActions } from './product-row-actions'

interface ProductTableProps {
  products: Product[]
  isAdmin: boolean
  suppliers?: Pick<Supplier, 'id' | 'name'>[]
}

function totalStock(p: Product): number {
  return (p.variants ?? []).reduce((sum, v) => sum + v.stock_quantity, 0)
}

export function ProductTable({ products, isAdmin, suppliers = [] }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-foreground/45 text-sm">No hay productos cargados aún.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/[0.06] bg-background">
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Producto</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Talles</th>
            {isAdmin && (
              <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Costo</th>
            )}
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Precio</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Stock</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Estado</th>
            {isAdmin && (
              <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const total = totalStock(p)
            const sorted = [...(p.variants ?? [])].sort((a, b) => Number(a.size) - Number(b.size))
            return (
              <tr key={p.id} className="border-b border-foreground/[0.06] hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  {p.brand} {p.model}
                  <span className="text-foreground/55 text-xs ml-1">· {p.color}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {sorted.length === 0 && <span className="text-foreground/40 text-xs">—</span>}
                    {sorted.map(v => (
                      <span
                        key={v.id}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums border ${
                          v.stock_quantity === 0
                            ? 'border-foreground/10 text-foreground/35 line-through'
                            : v.stock_quantity === 1
                            ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : 'border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                        }`}
                        title={`Talle ${v.size}: ${v.stock_quantity}`}
                      >
                        {v.size}<span className="opacity-60">·{v.stock_quantity}</span>
                      </span>
                    ))}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground/60 tabular-nums">{formatCurrency(p.cost_price)}</td>
                )}
                <td className="px-4 py-3 font-mono font-medium text-foreground tabular-nums">{formatCurrency(p.sale_price)}</td>
                <td className="px-4 py-3">
                  <span className={total === 0 ? 'font-bold text-red-600 dark:text-red-400' : total <= 2 ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {total}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${p.active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted border-foreground/10 text-foreground/55'}`}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <ProductRowActions product={p} suppliers={suppliers} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Actualizar acciones de fila (borrado)**

Reemplazar la función `del` en `src/components/products/product-row-actions.tsx` (líneas 27-33) para usar la server action, y actualizar el import:
```tsx
import { deleteProduct } from '@/app/actions/products'
```
```tsx
  async function del() {
    const { error } = await deleteProduct(product.id)
    if (error) return { error }
    router.refresh()
    return {}
  }
```
Quitar el import de `createClient` y de `deleteErrorMessage` si quedan sin uso. Quitar también el import `ConfirmDelete, deleteErrorMessage` → dejar solo `ConfirmDelete`.

- [ ] **Step 5: Limpiar el mensaje de error de borrado**

En `src/components/common/confirm-delete.tsx`, reemplazar la función `deleteErrorMessage` (líneas 62-68) por una versión genérica (el caso 23503 ya no debería ocurrir para productos):
```ts
/** Friendly message for common Postgres errors when deleting. */
export function deleteErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23503') {
    return 'No se puede borrar: hay registros que dependen de este elemento.'
  }
  return error.message
}
```

- [ ] **Step 6: Verificar build**

Run: `npx tsc --noEmit 2>&1 | grep -E "catalogo|product-table|product-row-actions|confirm-delete" | head`
Expected: sin líneas.

- [ ] **Step 7: Commit**

```bash
git add "src/app/(dashboard)/catalogo" src/components/products/product-table.tsx src/components/products/product-row-actions.tsx src/components/common/confirm-delete.tsx
git commit -m "feat: catalogo agrupado por producto con desglose por talle y borrado directo"
```

---

### Task 10: Página de stock desde variantes

**Files:**
- Modify: `src/app/(dashboard)/stock/page.tsx`
- Modify: `src/components/stock/stock-badge-button.tsx`
- Modify: `src/components/stock/adjustment-form.tsx`

**Interfaces:**
- Consumes: `product_variants` (Tarea 3), `buildProductGroups` (Tarea 2), `adjustStock(variantId, ...)` (Tarea 5).
- Produces: `StockBadgeButton` recibe `variantId: string` en lugar de `productId`; `AdjustmentForm` recibe `variantId: string`.

- [ ] **Step 1: Reescribir la page de stock**

Reemplazar el contenido de `src/app/(dashboard)/stock/page.tsx` por:
```tsx
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StockBadgeButton } from '@/components/stock/stock-badge-button'
import { ExportCsvButton } from '@/components/common/export-csv-button'
import { buildProductGroups, type VariantWithProduct } from '@/lib/utils/product-groups'

export default async function StockPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_variants')
    .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, active)')

  type Row = {
    id: string; product_id: string; size: string; stock_quantity: number
    products: { brand: string; model: string; color: string; active: boolean } | null
  }
  const rows = ((data as Row[]) ?? []).filter(r => r.products?.active)

  const variants: VariantWithProduct[] = rows.map(r => ({
    id: r.id, product_id: r.product_id, size: r.size, stock_quantity: r.stock_quantity,
    brand: r.products!.brand, model: r.products!.model, color: r.products!.color,
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

- [ ] **Step 2: Agregar la server action `ensureVariant`**

Agregar al final de `src/app/actions/products.ts`:
```ts
/** Devuelve el id de la variante (talle) creándola con stock 0 si no existe. */
export async function ensureVariant(productId: string, size: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: existing } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId).eq('size', size).maybeSingle()
  if (existing) return { id: existing.id }
  const { data, error } = await supabase
    .from('product_variants')
    .insert({ product_id: productId, size, stock_quantity: 0 })
    .select('id').single()
  if (error || !data) return { error: error?.message ?? 'No se pudo crear el talle' }
  return { id: data.id }
}
```

- [ ] **Step 3: Reescribir `StockBadgeButton` para variantes**

Cuando un talle está en 0 puede no existir la variante (`variantId === null`); el badge se ve tachado y, al ajustar, el form crea la variante primero. Reemplazar el contenido de `src/components/stock/stock-badge-button.tsx` por:
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
}

export function StockBadgeButton({ variantId, productId, productName, size, qty }: StockBadgeButtonProps) {
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
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Reescribir `AdjustmentForm` para variantes**

Reemplazar el contenido de `src/components/stock/adjustment-form.tsx` por:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { adjustStock } from '@/app/actions/stock'
import { ensureVariant } from '@/app/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdjustmentReason } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

interface AdjustmentFormProps {
  variantId: string | null
  productId: string
  size: string
  productName: string
  currentStock: number
  onClose: () => void
}

export function AdjustmentForm({ variantId, productId, size, productName, currentStock, onClose }: AdjustmentFormProps) {
  const router = useRouter()
  const [quantityChange, setQuantityChange] = useState(0)
  const [reason, setReason] = useState<AdjustmentReason>('ajuste_manual')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resultingStock = currentStock + quantityChange

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (quantityChange === 0) { setError('El cambio debe ser distinto de 0'); return }
    if (resultingStock < 0) { setError('El stock no puede quedar negativo'); return }
    setLoading(true)

    // Si el talle todavía no existe como variante, crearlo primero.
    let vId = variantId
    if (!vId) {
      const { id, error: ensureErr } = await ensureVariant(productId, size)
      if (ensureErr || !id) { setError(ensureErr ?? 'No se pudo crear el talle'); setLoading(false); return }
      vId = id
    }

    const { error: adjErr } = await adjustStock(vId, quantityChange, reason, notes)
    if (adjErr) { setError(adjErr); setLoading(false); return }
    toast.success(`Stock ajustado a ${resultingStock} ud.`)
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

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Guardando...' : 'Confirmar ajuste'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Verificar build**

Run: `npx tsc --noEmit 2>&1 | grep -E "stock/page|stock-badge-button|adjustment-form|actions/products" | head`
Expected: sin líneas.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/stock/page.tsx" src/components/stock/stock-badge-button.tsx src/components/stock/adjustment-form.tsx src/app/actions/products.ts
git commit -m "feat: stock por variante con ajuste por talle y umbral bajo = 1"
```

---

### Task 11: Adaptar formularios de venta y compra a variantes

Los formularios deben listar variantes (talles) seleccionables etiquetadas "Marca Modelo Color T{talle}", en vez de productos-fila. Es una adaptación mínima; el rediseño completo de ventas/compras es de fases posteriores.

**Files:**
- Modify: `src/app/(dashboard)/ventas/nueva/page.tsx`
- Modify: `src/app/(dashboard)/compras/nueva/page.tsx`
- Modify: `src/components/sales/sale-form.tsx`
- Modify: `src/components/purchases/purchase-form.tsx`

**Interfaces:**
- Consumes: `createSale`/`createPurchase` con `variant_id` (Tareas 6-7).
- Produces: tipo local `VariantOption { id: string; product_id: string; brand: string; model: string; color: string; size: string; stock_quantity: number; sale_price: number; cost_price: number }` usado por ambos forms.

- [ ] **Step 1: Cargar variantes en la page de venta**

Reemplazar el contenido de `src/app/(dashboard)/ventas/nueva/page.tsx` por:
```tsx
import { createClient } from '@/lib/supabase/server'
import { SaleForm } from '@/components/sales/sale-form'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

export default async function NuevaVentaPage() {
  const supabase = await createClient()
  const [{ data: variantRows }, { data: customers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    supabase.from('customers').select('*').order('name'),
  ])

  const variants = ((variantRows as VariantRow[]) ?? [])
    .filter(v => v.products?.active && v.stock_quantity > 0)
    .map(v => ({
      id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
      brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
      sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
    }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Venta</h1>
      <SaleForm variants={variants} customers={customers ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Reescribir `sale-form.tsx` para variantes**

En `src/components/sales/sale-form.tsx`:
- Reemplazar el tipo de props `{ products: Product[]; customers: Customer[] }` por `{ variants: VariantOption[]; customers: Customer[] }` con:
  ```ts
  export interface VariantOption {
    id: string; product_id: string
    brand: string; model: string; color: string; size: string
    stock_quantity: number; sale_price: number; cost_price: number
  }
  interface SaleItem { variant: VariantOption; quantity: number; unit_price: number; discount: number }
  ```
- `filteredProducts` → `filteredVariants` filtra `variants` por `` `${v.brand} ${v.model} ${v.color} ${v.size}` `` incluyendo `search` (quitar referencia a `sku` y a `p.active`/`stock_quantity` que ahora vienen pre-filtrados por la page, pero mantené el chequeo `v.stock_quantity > 0` por las dudas).
- `addItem(v)` usa `v.stock_quantity` y `v.sale_price`; el `key`/identidad de item pasa a `i.variant.id`.
- En la fila del item, mostrar `{item.variant.brand} {item.variant.model} T{item.variant.size}` y `({item.variant.color})`.
- En `handleSubmit`, `items.map(i => ({ variant_id: i.variant.id, quantity: i.quantity, unit_price: i.unit_price, discount: i.discount }))`.
- El `customer_id` ahora es obligatorio: cambiar el `<select>` para que la opción por defecto sea "Seleccionar cliente" (sin la opción "Sin cliente / mostrador") y validar en submit `if (!customerId) { setError('Seleccioná un cliente'); return }`. Cambiar el label a `Cliente` (sin "(opcional)").
- El manejo del lector de barras por `sku` (handleSearchKeyDown) queda sin SKU: cambiar a que Enter agregue el único resultado si `filteredVariants.length === 1`.

- [ ] **Step 3: Cargar variantes en la page de compra**

Reemplazar el contenido de `src/app/(dashboard)/compras/nueva/page.tsx` por (nota: en compra **no** se filtra por stock — se puede comprar un talle en 0):
```tsx
import { createClient } from '@/lib/supabase/server'
import { PurchaseForm } from '@/components/purchases/purchase-form'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

export default async function NuevaCompraPage() {
  const supabase = await createClient()
  const [{ data: variantRows }, { data: suppliers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    supabase.from('suppliers').select('*').order('name'),
  ])

  const variants = ((variantRows as VariantRow[]) ?? [])
    .filter(v => v.products?.active)
    .map(v => ({
      id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
      brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
      sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
    }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Compra</h1>
      <PurchaseForm variants={variants} suppliers={suppliers ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Reescribir `purchase-form.tsx` para variantes**

En `src/components/purchases/purchase-form.tsx`, aplicar los mismos cambios que en sale-form pero para compra (mismo patrón `VariantOption` ya mostrado en Step 2):
- Props `{ variants: VariantOption[]; suppliers: Supplier[] }`, importando `import { type VariantOption } from '@/components/sales/sale-form'` (exportar el tipo desde sale-form en el Step 2).
- `PurchaseItem { variant: VariantOption; quantity: number; unit_cost: number }`.
- `filteredProducts` → `filteredVariants` filtra por `` `${v.brand} ${v.model} ${v.color} ${v.size}` `` con `search`.
- `addItem(v)` usa `v.cost_price` para `unit_cost`; identidad de item por `i.variant.id` (reemplazar todos los `i.product.id` por `i.variant.id`).
- Filas y resultados de búsqueda muestran `{v.brand} {v.model} — {v.color} T{v.size}` y `{item.variant.brand} {item.variant.model} T{item.variant.size}`.
- `handleSubmit`: `items.map(i => ({ variant_id: i.variant.id, quantity: i.quantity, unit_cost: i.unit_cost }))`.
- Quitar el import de `Product` de `@/types/database` (ya no se usa); mantener `Supplier`.

- [ ] **Step 5: Verificar build completo**

Run: `npm run build`
Expected: **build exitoso, sin errores de TypeScript.** Este es el gate final de tipos de toda la fase. Si hay errores, resolverlos antes de continuar (revisar que ningún archivo siga referenciando `product_id`, `stock_quantity` en products, `size`/`sku` en products, o `getSizesForGender`).

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/ventas/nueva/page.tsx" "src/app/(dashboard)/compras/nueva/page.tsx" src/components/sales/sale-form.tsx src/components/purchases/purchase-form.tsx
git commit -m "feat: formularios de venta y compra seleccionan variante (talle)"
```

---

### Task 12: Repuntar dashboard, finanzas, reportes e historial al nuevo modelo

Estas pantallas **no cambian funcional ni visualmente** — solo se repuntan sus consultas: los joins `sale_items → products` ahora pasan por `product_variants`, y las lecturas de stock/inventario salen de `product_variants` (products ya no tiene `size`/`stock_quantity`). Los listados de productos vendidos usan el snapshot `product_label` (robusto ante productos borrados).

**Files:**
- Modify: `src/app/(dashboard)/page.tsx`
- Modify: `src/app/(dashboard)/finanzas/page.tsx`
- Modify: `src/app/(dashboard)/reportes/page.tsx`
- Modify: `src/components/customers/customer-history.tsx`
- Modify: `src/lib/validations/sale.ts`
- Modify: `src/lib/validations/purchase.ts`

**Interfaces:**
- Consumes: nuevo esquema (Tarea 3), snapshots `product_label`/`size_label` en `sale_items` (Tarea 3).

- [ ] **Step 1: Dashboard — join de COGS por variante**

En `src/app/(dashboard)/page.tsx`:
- Query `monthlySales` (línea ~40): reemplazar el select por
  `.select('total_amount, sale_items(quantity, product_variants(products(cost_price)))')`.
- Tipo `CogsItem` y su reduce (líneas ~89-98): cambiar a
  ```ts
  type CogsItem = { quantity: number; product_variants: { products: { cost_price: number } | null } | null }
  ```
  y en el reduce interno leer `(item.product_variants?.products?.cost_price ?? 0) * item.quantity`.

- [ ] **Step 2: Dashboard — alertas de stock desde variantes**

- Query `stockAlerts` (líneas ~49-54): reemplazar por
  ```ts
    supabase
      .from('product_variants')
      .select('id, size, stock_quantity, products!inner(brand, model, color, active)')
      .lte('stock_quantity', 1)
      .eq('products.active', true)
      .order('stock_quantity', { ascending: true }),
  ```
- Después del `await Promise.all`, normalizar (reemplazar líneas ~106-107):
  ```ts
  type VariantAlert = { id: string; size: string; stock_quantity: number; products: { brand: string; model: string; color: string } | null }
  const alerts = (stockAlerts as VariantAlert[] | null) ?? []
  const criticalStock = alerts.filter(v => v.stock_quantity === 0)
  const lowStock = alerts.filter(v => v.stock_quantity > 0)
  ```
- En el KPI "Stock bajo" (líneas ~207-208) y la tarjeta "Stock crítico" (líneas ~343-368): reemplazar `stockAlerts?.length ?? 0` → `alerts.length`, `stockAlerts!.slice` → `alerts.slice`, `stockAlerts!.length` → `alerts.length`. Dentro del map, cambiar `p.brand` → `p.products?.brand`, `p.model` → `p.products?.model`, `p.color` → `p.products?.color` (dejar `p.size` y `p.stock_quantity` igual).

- [ ] **Step 3: Dashboard — top productos por snapshot y stock valorizado por variante**

- Query `topProducts` (líneas ~65-70): cambiar el select a
  `.select('quantity, unit_price, product_label, sales!inner(sale_date, status)')`.
- Bloque "Top products from sale_items" (líneas ~134-143): reemplazar por
  ```ts
  const productMap: Record<string, { name: string; units: number; revenue: number }> = {}
  for (const item of (topProducts ?? []) as { quantity: number; unit_price: number; product_label: string | null }[]) {
    const name = item.product_label ?? 'Producto eliminado'
    if (!productMap[name]) productMap[name] = { name, units: 0, revenue: 0 }
    productMap[name].units += item.quantity
    productMap[name].revenue += item.unit_price * item.quantity
  }
  const topList = Object.values(productMap).sort((a, b) => b.units - a.units).slice(0, 5)
  ```
- Query `stockValProducts` (línea ~72): cambiar a
  `supabase.from('product_variants').select('stock_quantity, products!inner(cost_price, active)').eq('products.active', true),`.
- Cálculo `stockValue` (líneas ~110-112): reemplazar por
  ```ts
  type StockValRow = { stock_quantity: number; products: { cost_price: number } | null }
  const stockValue = ((stockValProducts as StockValRow[] | null) ?? []).reduce(
    (s, v) => s + (v.products?.cost_price ?? 0) * v.stock_quantity, 0
  )
  ```

- [ ] **Step 4: Finanzas — join de COGS por variante**

En `src/app/(dashboard)/finanzas/page.tsx`:
- Query `sales` (línea ~14): `.select('total_amount, sale_date, sale_items(quantity, product_variants(products(cost_price))))')`.
- Tipo `CogsItem` (línea ~26) y su reduce (líneas ~27-32): igual que en el dashboard —
  `type CogsItem = { quantity: number; product_variants: { products: { cost_price: number } | null } | null }` y leer `item.product_variants?.products?.cost_price`.

- [ ] **Step 5: Reportes — ventas por variante e inventario por variante**

En `src/app/(dashboard)/reportes/page.tsx`:
- Query `salesRaw` (línea ~14): cambiar el select a
  `.select('sale_date, total_amount, channel, payment_method, sale_items(quantity, unit_price, product_variants(products(id, brand, model, cost_price))))')`.
- Query `products` (líneas ~17-20): cambiar a traer productos con sus variantes:
  ```ts
    supabase
      .from('products')
      .select('id, brand, model, color, cost_price, variants:product_variants(stock_quantity)')
      .eq('active', true),
  ```
- Tipo `ReportItem` (líneas ~39-43): cambiar `products` por `product_variants`:
  ```ts
  type ReportItem = {
    quantity: number
    unit_price: number
    product_variants: { products: { id: string; brand: string; model: string; cost_price: number } | null } | null
  }
  ```
  y dentro del forEach leer `const p = item.product_variants?.products`.
- `stockValue` (línea ~66): reemplazar por un cálculo con stock total por producto:
  ```ts
  type ProdWithVariants = { id: string; brand: string; model: string; color: string; cost_price: number; variants: { stock_quantity: number }[] }
  const prods = (products as ProdWithVariants[] | null) ?? []
  const totalStock = (p: ProdWithVariants) => p.variants.reduce((s, v) => s + v.stock_quantity, 0)
  const stockValue = prods.reduce((s, p) => s + p.cost_price * totalStock(p), 0)
  ```
- `deadStock` (líneas ~70-74): reemplazar por
  ```ts
  const deadStock = prods
    .filter(p => totalStock(p) > 0 && !soldIds.has(p.id))
    .map(p => ({ ...p, units: totalStock(p), frozen: p.cost_price * totalStock(p) }))
    .sort((a, b) => b.frozen - a.frozen)
  ```
- En el JSX de "Stock sin movimiento" (línea ~198): cambiar `{p.color} · T{p.size} · {p.stock_quantity} ud.` por `{p.color} · {p.units} ud.`.

- [ ] **Step 6: Historial de cliente — usar snapshot**

En `src/components/customers/customer-history.tsx`:
- Tipo `HistorySale.sale_items` (líneas ~21-24): cambiar a
  ```ts
  sale_items: { quantity: number; product_label: string | null; size_label: string | null }[]
  ```
- Query (línea ~41): `.select('id, sale_date, total_amount, status, payment_method, sale_items(quantity, product_label, size_label))')`.
- Render de items (líneas ~69-74): reemplazar por
  ```ts
  {sale.sale_items
    .map(i => i.product_label ? `${i.quantity}× ${i.product_label} T${i.size_label ?? ''}` : `${i.quantity}× producto eliminado`)
    .join(' · ')}
  ```

- [ ] **Step 7: Validaciones — `variant_id`**

- En `src/lib/validations/sale.ts`, en `saleItemSchema`, cambiar `product_id: z.string().uuid()` por `variant_id: z.string().uuid()`.
- En `src/lib/validations/purchase.ts`, dentro del item, cambiar `product_id: z.string().uuid()` por `variant_id: z.string().uuid()`.

- [ ] **Step 8: Verificar build**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 9: Commit**

```bash
git add "src/app/(dashboard)/page.tsx" "src/app/(dashboard)/finanzas/page.tsx" "src/app/(dashboard)/reportes/page.tsx" src/components/customers/customer-history.tsx src/lib/validations/sale.ts src/lib/validations/purchase.ts
git commit -m "fix: repuntar dashboard, finanzas, reportes e historial al modelo producto/variante"
```

---

### Task 13: Verificación end-to-end + búsquedas de referencias muertas

**Files:** (sin cambios de código salvo que se encuentren referencias muertas)

- [ ] **Step 1: Buscar referencias muertas al modelo viejo**

Run:
```bash
grep -rn "stock_quantity" src/ | grep -i "product\b" ; \
grep -rn "getSizesForGender\|\.sku\b\|product_id" src/ ; \
grep -rn "\.size\b" src/components/sales src/components/purchases
```
Expected: revisar cada resultado. No debe quedar ninguna referencia a `products.stock_quantity`, `products.sku`, `products.size`, `getSizesForGender`, ni `product_id` en sale_items/purchase_items (todo debe ser `variant_id`). Referencias a `.size` en `product_variants` son correctas. Corregir cualquier resto y commitear.

- [ ] **Step 2: Correr todos los tests**

Run: `npm test`
Expected: PASA (tests de `sizes` y `product-groups` verdes).

- [ ] **Step 3: Levantar la app y verificar el flujo completo en el navegador**

Run: `npm run dev` y en el navegador (con un usuario admin logueado) verificar, en orden:

1. **Catálogo** (`/catalogo`): los productos aparecen agrupados (una fila por modelo+color) con el desglose por talle. Los talles en 0 se ven grises/tachados.
2. **Alta de producto:** "+ Nuevo producto" → cargar marca/modelo/color/precios y stock en la tabla de talles (ej. T39=1, T40=2). Guardar. **Verificar que el stock total del nuevo producto sea exactamente la suma cargada (3), NO el doble** (bug de stock 2 resuelto).
3. **Stock** (`/stock`): el producto nuevo aparece con su desglose (39→1, 40→2, resto en 0/tachado). El resumen "Stock bajo" cuenta talles con exactamente 1.
4. **Ajuste de stock:** clic en un badge de talle → ajustar (+/−) → confirmar. El stock se actualiza. Clic en un talle en 0 (sin variante) → ajustar a un número > 0 → se crea la variante y queda el stock.
5. **Venta** (`/ventas/nueva`): buscar un producto, se listan sus talles con stock; seleccionar cliente (obligatorio — sin cliente no deja confirmar), agregar item, confirmar. El stock del talle vendido baja.
6. **Compra** (`/compras/nueva`): seleccionar proveedor, agregar un talle, confirmar. El stock de ese talle sube.
7. **Borrar producto:** en el catálogo, eliminar un producto que YA tenga una venta registrada (del paso 5). **Verificar que se borra sin error** y que en `/ventas` la venta sigue mostrando el nombre y talle del producto (snapshot).

- [ ] **Step 4: Verificar el historial de ventas tras el borrado (SQL)**

En Supabase SQL Editor:
```sql
select id, product_label, size_label, variant_id from sale_items order by id desc limit 5;
```
Expected: las ventas del producto borrado tienen `variant_id = null` pero `product_label` y `size_label` conservan el nombre y talle. Las ventas de productos vivos tienen `variant_id` no nulo.

- [ ] **Step 5: Commit final (si hubo correcciones)**

```bash
git add -A
git commit -m "chore: limpieza de referencias al modelo viejo + verificacion fase 1"
```

---

## Notas para fases siguientes (no implementar ahora)

- **Fase 2 — Compras:** estado de entrega Pedido→Recibido (columna `delivery_status` en purchases; el stock suma recién al marcar Recibido — hoy suma al crear), historial por proveedor, pago a proveedor impacta en Caja.
- **Fase 3 — Ventas + Encargos + Clientes:** encargos con seña (nuevo estado de venta), alta de cliente y su historial, quitar `email`/`address`/`instagram` no usados si se confirma.
- **Fase 4 — Caja + Finanzas + Configuración:** categorías de gasto editables (nueva tabla), publicidad/packaging, ganancia bruta/neta, ranking de rentabilidad, datos del negocio (nombre+logo), rango de talles configurable.
- El campo `channel` de sales y `mercadopago` como medio de pago siguen en el esquema; la definición funcional no los mencionó — revisar en Fase 3 si se quitan.
