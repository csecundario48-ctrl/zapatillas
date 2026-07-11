# Fase 4 — Configuración — Design

**Fecha:** 2026-07-11
**Estado:** Aprobado por el usuario. Pendiente de plan de implementación.

## Contexto

Del rediseño funcional (`2026-07-09-rediseno-funcional-design.md`, módulo Configuración): el dueño debe poder ajustar por sí mismo, sin tocar código:
- **Datos del negocio:** nombre y logo.
- **Categorías de gastos:** agregar/editar (ej. publicidad, packaging).
- **Rango de talles:** el 35-45 usado en Talles/Variantes, ajustable a futuro.

Hoy el rango de talles (`SIZE_RANGE`) y las categorías (`EXPENSE_CATEGORIES`) están hardcodeados en `src/lib/utils/sizes.ts`. No existe página de Configuración ni almacenamiento en base para esto.

Alcance confirmado en el brainstorming (2026-07-11): las cuatro piezas — categorías de gastos editables, rango de talles ajustable, nombre del negocio, y logo del negocio (subida de imagen).

## Decisiones tomadas

- **Acceso:** `/configuracion` visible para cualquier usuario autenticado. No se separa admin/vendedor todavía (el spec mantiene los 2 roles pero no se pidió gating en esta fase).
- **Borrar categoría:** no afecta egresos ya cargados — conservan su etiqueta de texto (mismo criterio de snapshot que productos en ventas/compras).
- **Logo:** bucket público de Supabase Storage; la imagen se sube desde la página y se guarda la URL en `business_settings`.

## Modelo de datos (migración 010)

- **`business_settings`** — tabla de **una sola fila** (patrón singleton). Columnas:
  - `id` (PK, fijo a un valor conocido para forzar fila única)
  - `business_name text not null default 'Mi Negocio'`
  - `logo_url text` (nullable)
  - `size_min int not null default 35`
  - `size_max int not null default 45`
  - `updated_at timestamptz default now()`
  - Se inserta la fila inicial por defecto en la misma migración.
- **`expense_categories`** — tabla:
  - `id uuid default gen_random_uuid() primary key`
  - `name text not null unique`
  - `created_at timestamptz default now()`
  - Se siembra con las categorías actuales: `alquiler, servicios, marketing, delivery, salarios, packaging, otros`.
- **`expenses.category`**: se **quita el check constraint** que lo limita al enum (queda `text` libre). Las categorías se validan en la app contra `expense_categories`. Borrar una categoría no toca `expenses` viejos.
- **Storage:** bucket **`business`** público, creado en la migración (`insert into storage.buckets`) con policy de lectura pública y de escritura para autenticados.
- **RLS:** ambas tablas nuevas con RLS `auth_all` (lectura/escritura para autenticados), como el resto del esquema.

## Lógica pura (con tests)

`src/lib/utils/sizes.ts` (ampliar) o nuevo `src/lib/utils/size-range.ts`:
- `buildSizeRange(min: number, max: number): string[]` — array de strings de `min` a `max` inclusive; si `min > max` devuelve `[]`.
- `isValidSizeRange(min: number, max: number): boolean` — enteros, `min >= 1`, `min < max`, `max <= 60` (tope sano).

`src/lib/utils/category.ts`:
- `normalizeCategoryName(name: string): string` — `trim()`, colapsa espacios internos.
- (la validación de "no vacío" y unicidad se hace en la action).

Tests unitarios (Vitest) para `buildSizeRange`, `isValidSizeRange`, `normalizeCategoryName`.

## Página `/configuracion`

Server Component que carga `business_settings` y `expense_categories`, y renderiza tres secciones (cada una un Client Component con su propio estado y actions):

1. **Datos del negocio** (`business-settings-form.tsx`): input de nombre + subida de logo (input file → sube al bucket `business` con el cliente browser de Supabase → guarda `logo_url`). Muestra el logo actual si existe.
2. **Rango de talles** (dentro del mismo form de negocio o uno propio): inputs `size_min` / `size_max`, validados con `isValidSizeRange`. Aviso claro si es inválido.
3. **Categorías de gastos** (`expense-categories-manager.tsx`): lista con agregar (input + botón), renombrar (inline) y borrar (con confirmación). Usa `normalizeCategoryName`.

Navegación: agregar "Configuración" al menú (`nav-config.ts`), en un grupo nuevo o al final.

## Server actions (`src/app/actions/settings.ts`)

- `updateBusinessSettings(input: { business_name: string; size_min: number; size_max: number }): Promise<{ error?: string }>` — valida `isValidSizeRange`; actualiza la fila única.
- `updateLogo(logoUrl: string): Promise<{ error?: string }>` — guarda la URL del logo subido.
- `addExpenseCategory(name: string): Promise<{ error?: string }>` — normaliza, valida no vacío, inserta (unique → error amable si ya existe).
- `renameExpenseCategory(id: string, name: string): Promise<{ error?: string }>`.
- `deleteExpenseCategory(id: string): Promise<{ error?: string }>`.
- Todas `revalidatePath('/configuracion')` y las rutas afectadas (`/egresos`, `/catalogo`, `/` según corresponda).

## Enganches con lo existente

- **Egresos** (`expense-form.tsx` + `validations/expense.ts` + `egresos/page.tsx`): las categorías se leen desde `expense_categories` (se pasan como prop al form). La validación deja de usar `z.enum` fijo y pasa a `z.string().min(1)` (la existencia real se valida contra la base o se confía en el select poblado desde la base).
- **Talles** (`product-form.tsx` y donde se renderice): el rango se lee de `business_settings` (server) y se pasa como prop `sizeRange: string[]` al form, reemplazando el import directo de `SIZE_RANGE`. `SIZE_RANGE`/`getSizeRange()` quedan como fallback por defecto.
- **Sidebar** (`sidebar.tsx` / `mobile-nav.tsx`): muestran `business_name` y `logo_url` configurados (con fallback al nombre actual si no hay settings).

## Fuera de alcance

- Gating por rol (admin/vendedor) de la página de Configuración.
- Migrar los talles ya cargados si se achica el rango (los productos existentes conservan sus variantes; el rango solo afecta la carga nueva).
- Reordenar categorías / colores por categoría.
- Múltiples logos / temas.

## Testing / verificación

- Unit: `buildSizeRange`, `isValidSizeRange`, `normalizeCategoryName`.
- Build completo (`npm run build`) como gate de tipos.
- Checkpoint manual: aplicar migración 010 en Supabase (incluye creación del bucket).
- E2e manual: cambiar nombre del negocio y ver reflejo en sidebar; subir logo; ajustar rango de talles y ver la tabla de talles al cargar un producto; agregar/renombrar/borrar una categoría y verla en el form de Egresos.
