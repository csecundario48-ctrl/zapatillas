# Módulo de Outfits + Productos relacionados

**Fecha:** 2026-09-06
**Estado:** Aprobado para implementación

## 1. Problema y objetivo

El catálogo (zapatillas + ropa) hoy son productos sueltos. Se quiere poder
**combinar productos** (una zapatilla combina con tal pantalón, tal remera, tales
medias) y armar **outfits completos**, guardarlos como favoritos, y ver desde
cualquier producto con qué combina y en qué outfits está.

Objetivos:

1. Relacionar productos entre sí de forma **curada** (lo carga el usuario, no
   sugerencias automáticas).
2. **Outfit como único primitivo**: el "combina con" del ejemplo *es* un outfit.
   De ahí se derivan "productos relacionados" y los outfits de un producto.
3. **Ficha de producto** nueva (`/catalogo/[id]`) con una sección "Productos
   relacionados" + los outfits que lo incluyen.
4. **Página de outfits** (`/outfits`) para crear/editar/borrar y marcar favoritos.
5. **No romper nada.** Tablas nuevas, aditivo. El circuito de plata y el catálogo
   existente quedan intactos.

## 2. Decisiones (del brainstorming)

- **Modelo:** outfit como concepto único (no pares producto↔producto separados).
- **Ficha:** página dedicada `/catalogo/[id]`.
- **Relacionados:** solo lo cargado a mano (curado), mostrado automáticamente.
- **Favoritos:** a nivel negocio (flag en el outfit), no por usuario.
- **Fotos:** se usa `products.image_url` si existe; si no, placeholder. Sin subida
  de imágenes en este módulo.
- **Permisos:** crear/editar/borrar outfits = solo admin; el vendedor los ve.

## 3. Arquitectura de datos (migración `013_outfits.sql`)

Aditiva, idempotente, RLS `auth_all` como el resto.

**`outfits`**
```
id         uuid pk default gen_random_uuid()
name       text not null
notes      text
favorite   boolean not null default false
created_by uuid references auth.users(id)
created_at timestamptz not null default now()
```

**`outfit_items`** (qué productos forman el outfit)
```
id         uuid pk default gen_random_uuid()
outfit_id  uuid not null references outfits(id) on delete cascade
product_id uuid not null references products(id) on delete cascade
sort_order int not null default 0
created_at timestamptz not null default now()
unique (outfit_id, product_id)
```

Índices: `outfit_items(outfit_id)`, `outfit_items(product_id)`.

**Conceptos derivados (por query, sin tablas extra):**
- **Productos relacionados de P** = `distinct product_id` de `outfit_items` que
  comparten `outfit_id` con P, excluyendo P.
- **Outfits de P** = outfits cuyo `outfit_items` incluye P.
- **Favoritos** = `outfits.favorite = true`.

Borrar un producto elimina sus `outfit_items` por cascade; el outfit sobrevive
(puede quedar con menos productos, incluso vacío — se muestra igual y se puede
editar/borrar).

## 4. Componentes y flujo

### 4.1 Helper testeable — `src/lib/outfits/related.ts`
Función pura, con tests (TDD):
```
relatedProductIds(
  items: { outfit_id: string; product_id: string }[],
  productId: string
): string[]
```
Devuelve los ids de productos que comparten algún outfit con `productId`, sin
repetir y sin incluirlo. Es el corazón de "productos relacionados".

### 4.2 Server actions — `src/app/actions/outfits.ts`
Todas validan usuario autenticado (y admin donde corresponde vía RLS/rol):
- `createOutfit({ name, favorite, productIds })` → inserta outfit + items.
- `updateOutfit(id, { name, notes, favorite })`.
- `setOutfitProducts(id, productIds)` → reemplaza el set de items (agregar/quitar
  productos de un saque). Preserva `sort_order` por orden del array.
- `toggleFavorite(id, value)`.
- `deleteOutfit(id)` → borra outfit (items caen por cascade).
`revalidatePath('/outfits')` y `/catalogo` en cada mutación.

### 4.3 Ficha de producto — `src/app/(dashboard)/catalogo/[id]/page.tsx` (nueva)
Server component. Carga el producto (con categoría, atributos, variantes,
proveedor), sus outfits y los productos relacionados derivados.
- **Cabecera:** foto (`image_url` o placeholder), marca·modelo·color, categoría,
  atributos, precio, stock por talle (solo lectura). Link "← Catálogo".
- **Sección "Productos relacionados":** cards de los productos relacionados; cada
  una linkea a `/catalogo/[id]` de ese producto. Si no hay, vacío con CTA.
- **Sección "Outfits":** los outfits que incluyen el producto; cada card lista sus
  productos (con link). Botón **"Armar outfit con este"** (abre el editor con el
  producto ya agregado) — solo admin.
- El nombre del producto en la tabla del catálogo (`product-table.tsx`) pasa a ser
  `<Link href="/catalogo/[id]">`.

### 4.4 Página de outfits — `src/app/(dashboard)/outfits/page.tsx` (nueva)
Server carga todos los outfits con sus productos; cliente (`outfits-client.tsx`)
maneja filtro y diálogos.
- Galería de cards: nombre, ⭐ favorito (toggle), productos (thumbnails/nombre con
  link a su ficha), acciones editar/borrar (admin).
- Filtro **Favoritos**.
- "+ Nuevo outfit" (admin) → **editor** (`outfit-form.tsx`): nombre, favorito, y un
  **selector de productos con buscador** (marca/modelo/color/categoría) para
  agregar/quitar. El mismo editor sirve para crear y editar, y para "Armar outfit
  con este" (preselecciona un producto).
- Nuevo item de menú **Outfits** en la navegación (grupo Inventario).

### 4.5 Selector de productos (`outfit-product-picker`)
Reutilizable: recibe la lista de productos del catálogo y el set seleccionado,
buscador de texto + lista con checkbox/chips. Se usa en el editor de outfits.

## 5. Qué NO se rompe
- `products`, variantes, ventas, compras, ajustes, caja/finanzas: intactos.
- El catálogo sigue funcionando igual; solo se agrega el link a la ficha.
- Si un producto se borra, sus relaciones desaparecen solas (cascade); ningún
  outfit queda colgado ni rompe.

## 6. Plan de implementación (incremental, commiteable por partes)
1. Migración `013` (tablas + índices + RLS) y tipos en `database.ts`.
2. Helper `related.ts` + tests.
3. Server actions `outfits.ts`.
4. Editor de outfits + selector de productos.
5. Página `/outfits` + item de menú.
6. Ficha `/catalogo/[id]` (relacionados + outfits + "armar outfit con este").
7. Link del nombre de producto en la tabla del catálogo → ficha.

Cada paso deja el sistema compilando y andando. La migración `013` se aplica en
Supabase (SQL Editor) igual que la `012`.
