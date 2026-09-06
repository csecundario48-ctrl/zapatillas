# Catálogo multi-categoría + rubros (Zapatillas y Ropa)

**Fecha:** 2026-09-01
**Estado:** Aprobado para implementación

## 1. Problema y objetivo

El sistema es el control completo (stock, catálogo, compras, ventas, gastos,
finanzas, reportes) de un emprendimiento de **zapatillas**. Ahora el mismo
emprendimiento va a vender también **ropa** (pantalones, remeras, buzos,
camperas, shorts, gorras, accesorios).

Objetivos:

1. **Catálogo multi-categoría.** Cada categoría tiene atributos propios
   (una remera tiene corte/manga; una zapatilla tiene material) y su propio
   vocabulario de talles (35–45 vs S/M/L/XL vs "Única").
2. **Escalable desde la UI.** Se pueden crear categorías, atributos y talles
   nuevos desde Configuración, **sin tocar código ni migrar**.
3. **Rubro transversal.** Poder separar/filtrar la plata por línea de negocio:
   gastos de zapatillas vs ropa, proveedores por rubro, y P&L por rubro.
4. **No romper nada de lo existente.** El circuito de plata (compras → stock →
   ventas → caja → finanzas) queda intacto; todos los productos actuales pasan a
   la categoría `zapatillas` porque eso son.

## 2. Estado actual (resumen)

- `products`: `brand, model, color, gender, cost_price, sale_price,
  discount_price, image_url, description, supplier_id, active`. Cableado a
  zapatillas.
- `product_variants`: eje de variante = **talle → stock**. Sirve tal cual para
  ropa.
- `sale_items` / `purchase_items` / `stock_adjustments`: apuntan a `variant_id`
  + snapshots (`product_label`, `size_label`, `unit_cost`). **No se tocan** en
  su lógica.
- Filtros de catálogo: búsqueda de texto client-side (marca/modelo/color) +
  talle. Marcas hardcodeadas en `src/lib/utils/sizes.ts`. Talles numéricos
  35–45.

## 3. Arquitectura

Dos dimensiones nuevas, ambas administrables desde la UI:

- **Categoría** (por producto): define atributos y talles del producto.
- **Rubro / línea** (transversal): agrupa categorías, proveedores, gastos,
  compras y ventas para separar la plata.

Patrón: **definiciones en tablas** (editables desde la UI) y **valores en JSONB**
sobre el producto (una fila, sin EAV clásico ni joins pesados). Los campos
universales siguen siendo columnas.

### 3.1 Tablas nuevas

**`business_lines`** (rubros)
```
id uuid pk
name text not null            -- "Zapatillas", "Ropa"
slug text unique not null      -- "zapatillas", "ropa"
sort_order int default 0
created_at timestamptz default now()
```
Seed: Zapatillas, Ropa.

**`product_categories`**
```
id uuid pk
line_id uuid references business_lines(id)   -- rubro al que pertenece
name text not null              -- "Pantalones"
slug text unique not null        -- "pantalones"
size_options jsonb not null default '[]'     -- ["S","M","L","XL"] | ["35".."45"] | ["Única"]
sort_order int default 0
active boolean default true
created_at timestamptz default now()
```
Seed: las 8 categorías (ver §5).

**`category_attributes`** (campos propios por categoría — motor del form dinámico)
```
id uuid pk
category_id uuid references product_categories(id) on delete cascade
key text not null               -- "tipo", "corte", "manga", "material"
label text not null             -- "Tipo", "Corte"
type text not null check (type in ('text','number','select'))
options jsonb default '[]'       -- ["Cargo","Baggy","Wide","Recto"] si es select
required boolean default false
filterable boolean default false
sort_order int default 0
unique (category_id, key)
```

**`brands`** (marcas administrables; reemplaza la lista hardcodeada)
```
id uuid pk
name text unique not null
created_at timestamptz default now()
```
Seed: las marcas actuales de `BRANDS`.

### 3.2 Columnas nuevas (aditivas)

**`products`**
```
+ category_id uuid references product_categories(id)
+ attributes  jsonb not null default '{}'    -- { "tipo": "Cargo", "material": "Gabardina" }
```
Backfill: todos los productos existentes → categoría `zapatillas`.

**`suppliers`**
```
+ line_id uuid references business_lines(id)   -- null = ambos/general
```

**`expenses`**
```
+ line_id uuid references business_lines(id)   -- null = general/compartido
```

**`sale_items` y `purchase_items`** (snapshot aditivo para reportes por rubro
robustos aun si se borra el producto)
```
+ line_id       uuid references business_lines(id)
+ category_label text
```
Se completan al crear el ítem, derivando de la categoría del producto. No cambia
ninguna otra lógica del write path (cantidades, costos, caja siguen igual).

### 3.3 Campos universales (columnas, NO se tocan)

`brand, model, color, gender, cost_price, sale_price, discount_price,
image_url, description, supplier_id, active`. El eje de variante sigue siendo
`product_variants` (talle → stock).

Los `category_attributes` guardan **solo los campos extra** de cada categoría, no
duplican los universales.

## 4. Componentes y flujo

### 4.1 Registro de datos (server actions)
- `products.ts`: `ProductInput` gana `category_id` y `attributes`. `createProduct`
  / `updateProduct` insertan/actualizan esas columnas. La lógica de variantes y
  la compra automática al proveedor **no cambian**.
- Al crear `sale_items` / `purchase_items`, derivar y snapshotear `line_id` +
  `category_label` desde el producto de la variante.

### 4.2 Formulario dinámico (`product-form.tsx`)
1. Selector de **categoría** (desde `product_categories`).
2. Campos universales (marca desde `brands`, modelo, color, género, costo,
   precio, proveedor).
3. Atributos dinámicos leídos de `category_attributes` de esa categoría
   (`select` → dropdown con `options`; `text` → input; `number` → input number).
4. Tabla de talles construida desde `size_options` de la categoría (en vez del
   rango fijo 35–45).

Se agrega un helper `src/lib/catalog/` para tipos/carga de categorías y atributos.

### 4.3 Admin en Configuración
Reutiliza el patrón de `expense-categories-manager`:
- CRUD de **rubros** (business_lines).
- CRUD de **categorías** (nombre, rubro, talles) y sus **atributos**.
- CRUD de **marcas**.

### 4.4 Filtros inteligentes (catálogo)
Barra de filtros combinables, client-side sobre lo ya cargado (patrón actual):
**Rubro · Categoría · Marca · Color · Talle** + búsqueda de texto existente.
Bonus: filtrar por atributos marcados `filterable`.

### 4.5 Rubro en el circuito de plata
- **Proveedores:** filtro por rubro; campo rubro en el form.
- **Gastos:** selector de rubro en el form (incluye "General/Compartido" = null);
  filtro y columna en la lista.
- **Finanzas / Reportes:** desglose por rubro — ingresos (sale_items del rubro),
  costo (unit_cost de esos items), gastos directos del rubro; los gastos
  generales (line_id null) se muestran en su propio bucket, sin prorratear.

## 5. Seed de categorías (migración)

| Categoría | Rubro | Talles | Atributos (extra) |
|---|---|---|---|
| Zapatillas | Zapatillas | 35–45 | material (text) |
| Pantalones | Ropa | S,M,L,XL,XXL | tipo (select: Cargo/Baggy/Wide/Recto), material (text) |
| Remeras | Ropa | S,M,L,XL,XXL | corte (select: Oversize/Regular), manga (select: Corta/Larga), material (text) |
| Buzos | Ropa | S,M,L,XL,XXL | material (text) |
| Camperas | Ropa | S,M,L,XL,XXL | material (text) |
| Shorts | Ropa | S,M,L,XL,XXL | material (text) |
| Gorras | Ropa | Única, S/M, L/XL | material (text) |
| Accesorios | Ropa | Única | material (text) |

(Marca, modelo, color, género, costo, precio, talle son universales y no se
listan como atributos.) Los valores exactos se pueden ajustar después desde la
UI.

## 6. Migración segura (`012_multicategoria_rubros.sql`)

En una transacción, idempotente donde se pueda:
1. Crear `business_lines`, `product_categories`, `category_attributes`, `brands`.
2. Sembrar rubros, categorías, atributos y marcas.
3. `products`: agregar `category_id`, `attributes`; backfill todo →
   `zapatillas`.
4. `suppliers.line_id`, `expenses.line_id` (nullable).
5. `sale_items` / `purchase_items`: agregar `line_id`, `category_label`
   (nullable; el histórico queda null, aceptable). Backfill opcional de los
   existentes a rubro Zapatillas.
6. RLS de las tablas nuevas con el mismo patrón `auth_all` de las demás.

## 7. Qué NO se rompe

- Variantes, ventas, compras, ajustes de stock: lógica intacta.
- Circuito de plata (compra automática, caja, finanzas): intacto.
- Productos actuales: mismos datos, ahora categoría `zapatillas`, rubro
  Zapatillas.
- El rango de talles global de Configuración (`size_min/size_max`) queda como
  legacy; los talles pasan a vivir por categoría (`size_options`), sembrados
  desde el rango actual para zapatillas.

## 8. Plan de implementación (fases)

**Fase A — Catálogo multi-categoría**
1. Migración: tablas + seed + columnas `products` + backfill.
2. Tipos (`database.ts`) + validaciones (`product.ts`) + helper `src/lib/catalog/`.
3. Server actions de categorías/atributos/marcas/rubros.
4. `ProductForm` dinámico.
5. Filtros de catálogo (rubro/categoría/marca/color/talle).
6. Admin en Configuración.

**Fase B — Rubro transversal (plata)**
7. `suppliers.line_id` + `expenses.line_id` + snapshots en items.
8. Filtros en Proveedores y Gastos.
9. Desglose por rubro en Finanzas/Reportes.

Se commitea de forma incremental; cada fase deja el sistema funcionando.

## 9. Nota de implementación

Este repo usa una versión de Next.js con cambios; **antes de escribir código** se
leen las guías relevantes en `node_modules/next/dist/docs/` (Server Actions,
formularios) según indica `AGENTS.md`.
