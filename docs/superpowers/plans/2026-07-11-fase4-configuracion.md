# Fase 4 — Configuración — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el dueño pueda editar desde la app el nombre y logo del negocio, el rango de talles y las categorías de gastos, sin tocar código.

**Architecture:** Se agregan dos tablas (`business_settings` fila-única y `expense_categories`) y un bucket de Storage `business`. Un `SettingsProvider` (context) montado en el layout del dashboard reparte los settings de negocio (nombre, logo, rango de talles) a los componentes cliente que los consumen (sidebar, mobile-nav, form de productos). Las categorías se leen de la base en Egresos y en la nueva página `/configuracion`, que ofrece las tres secciones de edición vía server actions.

**Tech Stack:** Next.js 16 App Router (Turbopack), Supabase (RLS `auth_all`, Storage, migraciones a mano), TypeScript, Vitest (solo lógica pura), Tailwind, react-hook-form + zod.

## Global Constraints

- **Next.js con breaking changes:** consultar `node_modules/next/dist/docs/` antes de tocar patrones de App Router / Server Actions. Params de página son async.
- **Migraciones a mano** en Supabase SQL Editor. La 010 la aplica el usuario (incluye crear el bucket de Storage). El código compila sin ella pero necesita la base para correr.
- **RLS:** patrón del proyecto `for all to authenticated using (true) with check (true)` (ver `0001_rls_policies.sql`). Las tablas nuevas lo replican.
- **Idioma:** UI y errores en español rioplatense.
- **Acceso:** `/configuracion` para cualquier usuario autenticado (sin gating por rol en esta fase).
- **Borrar categoría** no toca egresos ya cargados (conservan la etiqueta de texto).
- **Nav real:** `src/components/layout/nav-config.ts` (`nav-items.ts` es duplicado muerto, no tocar).
- **Cliente browser de Supabase:** `import { createClient } from '@/lib/supabase/client'` (usado para subir el logo).

---

### Task 1: Modelo — migración 010 + tipos

Crea las tablas de settings y categorías, el bucket de logo, quita el check de categoría de `expenses`, y agrega los tipos.

**Files:**
- Create: `supabase/migrations/010_settings.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: `BusinessSettings` y `ExpenseCategoryRow` interfaces; `ExpenseCategory = string`; entradas en `Database['public']['Tables']` para `business_settings` y `expense_categories`.

- [ ] **Step 1: Escribir la migración 010**

Create `supabase/migrations/010_settings.sql`:
```sql
-- =============================================================================
-- 010_settings.sql — Rediseño Fase 4 (Configuración)
-- Tablas de configuración editable: datos del negocio (fila única), rango de
-- talles, y categorías de gastos. Bucket de Storage 'business' para el logo.
-- Aplicar en Supabase Dashboard -> SQL Editor (con backup). Correr una sola vez.
-- =============================================================================

begin;

-- 1) Datos del negocio + rango de talles: tabla de UNA sola fila (singleton).
create table if not exists business_settings (
  id            int primary key default 1,
  business_name text not null default 'Mi Negocio',
  logo_url      text,
  size_min      int  not null default 35,
  size_max      int  not null default 45,
  updated_at    timestamptz not null default now(),
  constraint business_settings_singleton check (id = 1)
);
insert into business_settings (id) values (1) on conflict (id) do nothing;

-- 2) Categorías de gastos.
create table if not exists expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);
insert into expense_categories (name)
  values ('alquiler'), ('servicios'), ('marketing'), ('delivery'),
         ('salarios'), ('packaging'), ('otros')
  on conflict (name) do nothing;

-- 3) Quitar el check que limitaba expenses.category al enum viejo.
alter table expenses drop constraint if exists expenses_category_check;

-- 4) RLS igual al resto del esquema: todo autenticado.
alter table business_settings   enable row level security;
alter table expense_categories  enable row level security;

drop policy if exists "auth_all_business_settings" on business_settings;
create policy "auth_all_business_settings" on business_settings
  for all to authenticated using (true) with check (true);

drop policy if exists "auth_all_expense_categories" on expense_categories;
create policy "auth_all_expense_categories" on expense_categories
  for all to authenticated using (true) with check (true);

-- 5) Bucket público para el logo + policies en storage.objects.
insert into storage.buckets (id, name, public)
  values ('business', 'business', true)
  on conflict (id) do nothing;

drop policy if exists "business_public_read" on storage.objects;
create policy "business_public_read" on storage.objects
  for select using (bucket_id = 'business');

drop policy if exists "business_auth_write" on storage.objects;
create policy "business_auth_write" on storage.objects
  for insert to authenticated with check (bucket_id = 'business');

drop policy if exists "business_auth_update" on storage.objects;
create policy "business_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'business');

commit;
```

- [ ] **Step 2: Agregar los tipos**

En `src/types/database.ts`:
- Cambiar la línea del tipo `ExpenseCategory` (el union largo `'alquiler' | 'servicios' | ...`) por:
  ```ts
  export type ExpenseCategory = string
  ```
- Agregar dos interfaces nuevas (después de `export interface Expense { ... }`):
  ```ts
  export interface BusinessSettings {
    id: number
    business_name: string
    logo_url: string | null
    size_min: number
    size_max: number
    updated_at: string
  }

  export interface ExpenseCategoryRow {
    id: string
    name: string
    created_at: string
  }
  ```
- En `Database['public']['Tables']`, agregar dos entradas (después de `expenses: { ... }`):
  ```ts
      business_settings: {
        Row: BusinessSettings
        Insert: Partial<BusinessSettings> & { id?: number }
        Update: Partial<Omit<BusinessSettings, 'id'>>
        Relationships: []
      }
      expense_categories: {
        Row: ExpenseCategoryRow
        Insert: Omit<ExpenseCategoryRow, 'id' | 'created_at'>
        Update: Partial<Omit<ExpenseCategoryRow, 'id' | 'created_at'>>
        Relationships: []
      }
  ```

- [ ] **Step 3: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "database.ts" | head`
Expected: sin líneas.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/010_settings.sql src/types/database.ts
git commit -m "feat(fase4): modelo settings (migracion 010: negocio, talles, categorias, bucket logo)"
```

---

### Task 2: Lógica pura de rango de talles y categorías + tests

**Files:**
- Create: `src/lib/utils/size-range.ts`
- Create: `src/lib/utils/size-range.test.ts`
- Create: `src/lib/utils/category.ts`
- Create: `src/lib/utils/category.test.ts`

**Interfaces:**
- Produces:
  - `buildSizeRange(min: number, max: number): string[]` — strings de `min` a `max` inclusive; `[]` si `min > max`.
  - `isValidSizeRange(min: number, max: number): boolean` — enteros, `min >= 1`, `min < max`, `max <= 60`.
  - `normalizeCategoryName(name: string): string` — `trim()` + colapsa espacios internos a uno.

- [ ] **Step 1: Escribir los tests que fallan**

Create `src/lib/utils/size-range.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildSizeRange, isValidSizeRange } from './size-range'

describe('buildSizeRange', () => {
  it('genera el rango inclusivo como strings', () => {
    expect(buildSizeRange(35, 38)).toEqual(['35', '36', '37', '38'])
  })
  it('un solo valor cuando min === max', () => {
    expect(buildSizeRange(40, 40)).toEqual(['40'])
  })
  it('vacío si min > max', () => {
    expect(buildSizeRange(45, 35)).toEqual([])
  })
})

describe('isValidSizeRange', () => {
  it('acepta un rango sano', () => {
    expect(isValidSizeRange(35, 45)).toBe(true)
    expect(isValidSizeRange(34, 46)).toBe(true)
  })
  it('rechaza min >= max', () => {
    expect(isValidSizeRange(40, 40)).toBe(false)
    expect(isValidSizeRange(45, 35)).toBe(false)
  })
  it('rechaza no enteros o fuera de límites', () => {
    expect(isValidSizeRange(35.5, 45)).toBe(false)
    expect(isValidSizeRange(0, 45)).toBe(false)
    expect(isValidSizeRange(35, 61)).toBe(false)
  })
})
```

Create `src/lib/utils/category.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeCategoryName } from './category'

describe('normalizeCategoryName', () => {
  it('recorta espacios en los extremos', () => {
    expect(normalizeCategoryName('  publicidad  ')).toBe('publicidad')
  })
  it('colapsa espacios internos', () => {
    expect(normalizeCategoryName('gastos   varios')).toBe('gastos varios')
  })
  it('deja vacío como vacío', () => {
    expect(normalizeCategoryName('   ')).toBe('')
  })
})
```

- [ ] **Step 2: Correr y verificar que fallan**

Run: `npx vitest run src/lib/utils/size-range.test.ts src/lib/utils/category.test.ts`
Expected: FAIL — módulos no encontrados.

- [ ] **Step 3: Implementar los helpers**

Create `src/lib/utils/size-range.ts`:
```ts
/** Rango de talles inclusivo como strings; vacío si min > max. */
export function buildSizeRange(min: number, max: number): string[] {
  if (min > max) return []
  const out: string[] = []
  for (let n = min; n <= max; n++) out.push(String(n))
  return out
}

/** Rango válido: enteros, min >= 1, min < max, max <= 60. */
export function isValidSizeRange(min: number, max: number): boolean {
  return (
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 1 &&
    min < max &&
    max <= 60
  )
}
```

Create `src/lib/utils/category.ts`:
```ts
/** Normaliza el nombre de una categoría: recorta y colapsa espacios internos. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}
```

- [ ] **Step 4: Correr y verificar que pasan**

Run: `npx vitest run src/lib/utils/size-range.test.ts src/lib/utils/category.test.ts`
Expected: PASS (9 tests en total).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/size-range.ts src/lib/utils/size-range.test.ts src/lib/utils/category.ts src/lib/utils/category.test.ts
git commit -m "feat(fase4): helpers puros buildSizeRange/isValidSizeRange/normalizeCategoryName + tests"
```

---

### Task 3: Server actions de configuración

**Files:**
- Create: `src/app/actions/settings.ts`

**Interfaces:**
- Consumes: `isValidSizeRange` (Task 2), `normalizeCategoryName` (Task 2).
- Produces:
  - `updateBusinessSettings(input: { business_name: string; size_min: number; size_max: number }): Promise<{ error?: string }>`
  - `updateLogo(logoUrl: string): Promise<{ error?: string }>`
  - `addExpenseCategory(name: string): Promise<{ error?: string }>`
  - `renameExpenseCategory(id: string, name: string): Promise<{ error?: string }>`
  - `deleteExpenseCategory(id: string): Promise<{ error?: string }>`

- [ ] **Step 1: Escribir las server actions**

Create `src/app/actions/settings.ts`:
```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isValidSizeRange } from '@/lib/utils/size-range'
import { normalizeCategoryName } from '@/lib/utils/category'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Actualiza nombre del negocio y rango de talles (fila única id=1). */
export async function updateBusinessSettings(
  input: { business_name: string; size_min: number; size_max: number }
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const name = input.business_name.trim()
  if (!name) return { error: 'El nombre del negocio no puede estar vacío' }
  if (!isValidSizeRange(input.size_min, input.size_max)) {
    return { error: 'Rango de talles inválido: usá enteros con mínimo menor al máximo (1 a 60)' }
  }

  const { error } = await supabase
    .from('business_settings')
    .update({
      business_name: name,
      size_min: input.size_min,
      size_max: input.size_max,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/catalogo')
  revalidatePath('/')
  return {}
}

/** Guarda la URL del logo ya subido al bucket. */
export async function updateLogo(logoUrl: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('business_settings')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/')
  return {}
}

/** Agrega una categoría de gasto (nombre único, normalizado). */
export async function addExpenseCategory(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('expense_categories').insert({ name: clean })
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una categoría con ese nombre' }
    return { error: error.message }
  }

  revalidatePath('/configuracion')
  revalidatePath('/egresos')
  return {}
}

/** Renombra una categoría existente. */
export async function renameExpenseCategory(id: string, name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('expense_categories').update({ name: clean }).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una categoría con ese nombre' }
    return { error: error.message }
  }

  revalidatePath('/configuracion')
  revalidatePath('/egresos')
  return {}
}

/** Borra una categoría. Los egresos ya cargados conservan su etiqueta. */
export async function deleteExpenseCategory(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/egresos')
  return {}
}
```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "actions/settings" | head`
Expected: sin líneas.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions/settings.ts
git commit -m "feat(fase4): server actions de configuracion (negocio, logo, categorias)"
```

---

### Task 4: SettingsProvider + layout + sidebar/mobile-nav muestran nombre y logo

Un context reparte los settings de negocio a los componentes cliente. El layout lo carga y lo monta. Sidebar y mobile-nav muestran el nombre y logo configurados.

**Files:**
- Create: `src/components/settings/settings-context.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`
- Modify: `src/components/layout/sidebar.tsx`
- Modify: `src/components/layout/mobile-nav.tsx`

**Interfaces:**
- Produces: `SettingsProvider`, `useSettings(): AppSettings` con `AppSettings = { businessName: string; logoUrl: string | null; sizeMin: number; sizeMax: number }`.
- Consumes: `BusinessSettings` (Task 1).

- [ ] **Step 1: Crear el context**

Create `src/components/settings/settings-context.tsx`:
```tsx
'use client'

import { createContext, useContext } from 'react'

export interface AppSettings {
  businessName: string
  logoUrl: string | null
  sizeMin: number
  sizeMax: number
}

const DEFAULTS: AppSettings = { businessName: 'KALA', logoUrl: null, sizeMin: 35, sizeMax: 45 }

const SettingsContext = createContext<AppSettings>(DEFAULTS)

export function SettingsProvider({ value, children }: { value: AppSettings; children: React.ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): AppSettings {
  return useContext(SettingsContext)
}
```

- [ ] **Step 2: Cargar settings en el layout y montar el provider**

En `src/app/(dashboard)/layout.tsx`:
- Agregar el import:
  ```ts
  import { SettingsProvider } from '@/components/settings/settings-context'
  import type { BusinessSettings } from '@/types/database'
  ```
- Después de obtener `user` (y antes del `return`), cargar los settings:
  ```ts
  const { data: settingsRow } = await supabase
    .from('business_settings')
    .select('business_name, logo_url, size_min, size_max')
    .eq('id', 1)
    .single()
  const s = settingsRow as Pick<BusinessSettings, 'business_name' | 'logo_url' | 'size_min' | 'size_max'> | null
  const appSettings = {
    businessName: s?.business_name ?? 'KALA',
    logoUrl: s?.logo_url ?? null,
    sizeMin: s?.size_min ?? 35,
    sizeMax: s?.size_max ?? 45,
  }
  ```
- Envolver TODO el árbol devuelto en el provider. Reemplazar `return (` + el `<div className="relative isolate ...">...</div>` de nivel superior de modo que quede:
  ```tsx
  return (
    <SettingsProvider value={appSettings}>
      <div className="relative isolate flex h-screen overflow-hidden bg-background">
        {/* ...contenido existente sin cambios... */}
      </div>
    </SettingsProvider>
  )
  ```
  (No cambiar nada del contenido interno; solo envolver el `<div>` raíz con `<SettingsProvider>`.)

- [ ] **Step 3: Sidebar usa nombre y logo configurados**

En `src/components/layout/sidebar.tsx`:
- Agregar el import:
  ```ts
  import { useSettings } from '@/components/settings/settings-context'
  ```
- Dentro de `Sidebar`, al tope de la función:
  ```ts
  const { businessName, logoUrl } = useSettings()
  ```
- Reemplazar el bloque del logo:
  ```tsx
      <div className="px-5 h-14 flex items-center border-b border-foreground/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kala-logo.png" alt="KALA" className="h-[18px] w-auto invert dark:invert-0" />
      </div>
  ```
  por:
  ```tsx
      <div className="px-5 h-14 flex items-center border-b border-foreground/[0.06]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={businessName} className="h-6 w-auto max-w-[140px] object-contain" />
        ) : (
          <span className="font-semibold text-sm tracking-tight text-foreground truncate">{businessName}</span>
        )}
      </div>
  ```
- Reemplazar el footer:
  ```tsx
        <p className="text-[10px] text-foreground/30 font-mono tracking-widest uppercase">KALA · v1.0</p>
  ```
  por:
  ```tsx
        <p className="text-[10px] text-foreground/30 font-mono tracking-widest uppercase truncate">{businessName} · v1.0</p>
  ```

- [ ] **Step 4: Mobile-nav usa nombre y logo configurados**

En `src/components/layout/mobile-nav.tsx`:
- Agregar el import:
  ```ts
  import { useSettings } from '@/components/settings/settings-context'
  ```
- Dentro de `MobileNav`, al tope:
  ```ts
  const { businessName, logoUrl } = useSettings()
  ```
- Reemplazar el bloque del logo:
  ```tsx
        <div className="px-5 h-14 flex items-center border-b border-foreground/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kala-logo.png" alt="KALA" className="h-[18px] w-auto invert dark:invert-0" />
        </div>
  ```
  por:
  ```tsx
        <div className="px-5 h-14 flex items-center border-b border-foreground/[0.06]">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={businessName} className="h-6 w-auto max-w-[150px] object-contain" />
          ) : (
            <span className="font-semibold text-sm tracking-tight text-foreground truncate">{businessName}</span>
          )}
        </div>
  ```

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "settings-context|layout.tsx|sidebar|mobile-nav" | head`
Expected: sin líneas.

- [ ] **Step 6: Commit**

```bash
git add src/components/settings/settings-context.tsx "src/app/(dashboard)/layout.tsx" src/components/layout/sidebar.tsx src/components/layout/mobile-nav.tsx
git commit -m "feat(fase4): SettingsProvider + sidebar/mobile-nav muestran nombre y logo del negocio"
```

---

### Task 5: El form de productos usa el rango de talles configurado

**Files:**
- Modify: `src/components/products/product-form.tsx`

**Interfaces:**
- Consumes: `useSettings` (Task 4), `buildSizeRange` (Task 2).

- [ ] **Step 1: Reemplazar `SIZE_RANGE` por el rango configurado**

En `src/components/products/product-form.tsx`:
- Cambiar el import de `SIZE_RANGE`. Reemplazar:
  ```ts
  import { SIZE_RANGE } from '@/lib/utils/sizes'
  import { BRANDS } from '@/lib/utils/sizes'
  ```
  por:
  ```ts
  import { BRANDS } from '@/lib/utils/sizes'
  import { buildSizeRange } from '@/lib/utils/size-range'
  import { useSettings } from '@/components/settings/settings-context'
  ```
- Dentro de `ProductForm`, después de `const editing = !!product`, obtener el rango:
  ```ts
  const { sizeMin, sizeMax } = useSettings()
  const sizeRange = buildSizeRange(sizeMin, sizeMax)
  ```
- Reemplazar la línea que usa `SIZE_RANGE`:
  ```ts
  const sizes = [...new Set([...SIZE_RANGE, ...existingSizes])].sort((a, b) => Number(a) - Number(b))
  ```
  por:
  ```ts
  const sizes = [...new Set([...sizeRange, ...existingSizes])].sort((a, b) => Number(a) - Number(b))
  ```

- [ ] **Step 2: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "product-form" | head`
Expected: sin líneas.

- [ ] **Step 3: Commit**

```bash
git add src/components/products/product-form.tsx
git commit -m "feat(fase4): el form de productos usa el rango de talles configurado"
```

---

### Task 6: Categorías de gasto desde la base

El form de Egresos y la validación dejan de usar la lista hardcodeada.

**Files:**
- Modify: `src/lib/validations/expense.ts`
- Modify: `src/components/expenses/expense-form.tsx`
- Modify: `src/app/(dashboard)/egresos/page.tsx`

**Interfaces:**
- Consumes: `ExpenseCategoryRow` (Task 1).

- [ ] **Step 1: Relajar la validación de categoría**

En `src/lib/validations/expense.ts`, reemplazar:
```ts
  category: z.enum([
    'alquiler', 'servicios', 'marketing', 'delivery',
    'salarios', 'packaging', 'otros',
  ]),
```
por:
```ts
  category: z.string().min(1, 'Elegí una categoría'),
```

- [ ] **Step 2: El form recibe las categorías por prop**

En `src/components/expenses/expense-form.tsx`:
- Quitar el import de `EXPENSE_CATEGORIES`. Eliminar la línea:
  ```ts
  import { EXPENSE_CATEGORIES } from '@/lib/utils/sizes'
  ```
- Cambiar la firma del componente para recibir `categories`:
  ```ts
  export function ExpenseForm({ categories, onSuccess }: { categories: string[]; onSuccess?: () => void }) {
  ```
- Reemplazar el `.map` del `<select>` de categoría:
  ```tsx
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c} value={c} className="capitalize bg-card">{c}</option>
            ))}
  ```
  por:
  ```tsx
            {categories.map(c => (
              <option key={c} value={c} className="capitalize bg-card">{c}</option>
            ))}
  ```

- [ ] **Step 3: La página de Egresos carga las categorías y las pasa al form**

En `src/app/(dashboard)/egresos/page.tsx`:
- En el cuerpo del componente, después de crear `supabase`, cargar categorías junto a los egresos. Reemplazar:
  ```ts
  const supabase = await createClient()
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })
  ```
  por:
  ```ts
  const supabase = await createClient()
  const [{ data: expenses }, { data: categoryRows }] = await Promise.all([
    supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    supabase.from('expense_categories').select('name').order('name'),
  ])
  const categories = ((categoryRows as { name: string }[] | null) ?? []).map(c => c.name)
  ```
- Pasar las categorías al form. Reemplazar:
  ```tsx
            <ExpenseForm />
  ```
  por:
  ```tsx
            <ExpenseForm categories={categories} />
  ```

- [ ] **Step 4: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "expense|egresos" | head`
Expected: sin líneas.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/expense.ts src/components/expenses/expense-form.tsx "src/app/(dashboard)/egresos/page.tsx"
git commit -m "feat(fase4): categorias de gasto desde la base en el form de Egresos"
```

---

### Task 7: Página `/configuracion` + componentes de edición + nav

**Files:**
- Create: `src/components/settings/business-settings-form.tsx`
- Create: `src/components/settings/expense-categories-manager.tsx`
- Create: `src/app/(dashboard)/configuracion/page.tsx`
- Modify: `src/components/layout/nav-config.ts`

**Interfaces:**
- Consumes: `updateBusinessSettings`, `updateLogo`, `addExpenseCategory`, `renameExpenseCategory`, `deleteExpenseCategory` (Task 3); `BusinessSettings`, `ExpenseCategoryRow` (Task 1); cliente browser de Supabase para subir el logo.

- [ ] **Step 1: Form de datos del negocio + rango de talles + logo**

Create `src/components/settings/business-settings-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { updateBusinessSettings, updateLogo } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const lbl = 'font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]'

interface Props {
  businessName: string
  logoUrl: string | null
  sizeMin: number
  sizeMax: number
}

export function BusinessSettingsForm({ businessName, logoUrl, sizeMin, sizeMax }: Props) {
  const router = useRouter()
  const [name, setName] = useState(businessName)
  const [min, setMin] = useState(sizeMin)
  const [max, setMax] = useState(sizeMax)
  const [logo, setLogo] = useState<string | null>(logoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function onSave() {
    setSaving(true)
    const { error } = await updateBusinessSettings({ business_name: name, size_min: min, size_max: max })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Datos del negocio guardados')
    router.refresh()
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('business').upload(path, file, { upsert: true })
    if (upErr) { setUploading(false); toast.error(`No se pudo subir: ${upErr.message}`); return }
    const { data } = supabase.storage.from('business').getPublicUrl(path)
    const url = data.publicUrl
    const { error } = await updateLogo(url)
    setUploading(false)
    if (error) { toast.error(error); return }
    setLogo(url)
    toast.success('Logo actualizado')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-6 space-y-5">
      <h2 className="text-sm font-semibold text-foreground">Datos del negocio</h2>

      <div className="space-y-1.5 max-w-sm">
        <Label className={lbl}>Nombre del negocio</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Negocio" />
      </div>

      <div className="space-y-1.5">
        <Label className={lbl}>Logo</Label>
        <div className="flex items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="h-10 w-auto max-w-[160px] object-contain rounded border border-foreground/10 bg-background p-1" />
          ) : (
            <span className="text-xs text-foreground/45">Sin logo</span>
          )}
          <label className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300">
            {uploading ? 'Subiendo...' : 'Subir imagen'}
            <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label className={lbl}>Rango de talles</Label>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} value={min} onChange={e => setMin(Number(e.target.value))} className="w-20 text-center" />
          <span className="text-foreground/45 text-sm">a</span>
          <Input type="number" min={1} value={max} onChange={e => setMax(Number(e.target.value))} className="w-20 text-center" />
        </div>
        <p className="text-[11px] text-foreground/55">Se usa al cargar el stock por talle de un producto.</p>
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar datos del negocio'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Gestor de categorías de gasto**

Create `src/components/settings/expense-categories-manager.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { addExpenseCategory, renameExpenseCategory, deleteExpenseCategory } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ExpenseCategoryRow } from '@/types/database'

export function ExpenseCategoriesManager({ categories }: { categories: ExpenseCategoryRow[] }) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function onAdd() {
    if (!newName.trim()) return
    setBusy(true)
    const { error } = await addExpenseCategory(newName)
    setBusy(false)
    if (error) { toast.error(error); return }
    setNewName('')
    toast.success('Categoría agregada')
    router.refresh()
  }

  async function onRename(id: string) {
    setBusy(true)
    const { error } = await renameExpenseCategory(id, editName)
    setBusy(false)
    if (error) { toast.error(error); return }
    setEditingId(null)
    toast.success('Categoría renombrada')
    router.refresh()
  }

  async function onDelete(id: string) {
    setBusy(true)
    const { error } = await deleteExpenseCategory(id)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Categoría borrada')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Categorías de gastos</h2>

      <div className="flex items-center gap-2 max-w-sm">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
          placeholder="Nueva categoría (ej. publicidad)"
        />
        <Button onClick={onAdd} disabled={busy || !newName.trim()}>Agregar</Button>
      </div>

      <div className="divide-y divide-foreground/[0.06] border-t border-foreground/[0.06]">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2.5">
            {editingId === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="max-w-xs" />
                <button type="button" onClick={() => onRename(c.id)} disabled={busy} className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Guardar"><Check size={14} /></button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-md text-foreground/45 hover:bg-foreground/[0.06] transition-colors" title="Cancelar"><X size={14} /></button>
              </div>
            ) : (
              <>
                <span className="text-sm text-foreground/90 capitalize">{c.name}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setEditingId(c.id); setEditName(c.name) }} className="p-1.5 rounded-md text-foreground/45 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Renombrar"><Pencil size={14} /></button>
                  <button type="button" onClick={() => onDelete(c.id)} disabled={busy} className="p-1.5 rounded-md text-foreground/45 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Borrar"><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {categories.length === 0 && <p className="py-4 text-sm text-foreground/45">No hay categorías. Agregá la primera.</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Página `/configuracion`**

Create `src/app/(dashboard)/configuracion/page.tsx`:
```tsx
import { createClient } from '@/lib/supabase/server'
import { BusinessSettingsForm } from '@/components/settings/business-settings-form'
import { ExpenseCategoriesManager } from '@/components/settings/expense-categories-manager'
import type { BusinessSettings, ExpenseCategoryRow } from '@/types/database'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const [{ data: settingsRow }, { data: categoryRows }] = await Promise.all([
    supabase.from('business_settings').select('*').eq('id', 1).single(),
    supabase.from('expense_categories').select('*').order('name'),
  ])

  const s = settingsRow as BusinessSettings | null
  const categories = (categoryRows as ExpenseCategoryRow[] | null) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
        <p className="text-sm text-foreground/55 mt-0.5">Datos del negocio, rango de talles y categorías de gastos</p>
      </div>

      <BusinessSettingsForm
        businessName={s?.business_name ?? 'Mi Negocio'}
        logoUrl={s?.logo_url ?? null}
        sizeMin={s?.size_min ?? 35}
        sizeMax={s?.size_max ?? 45}
      />

      <ExpenseCategoriesManager categories={categories} />
    </div>
  )
}
```

- [ ] **Step 4: Agregar "Configuración" al menú**

En `src/components/layout/nav-config.ts`:
- Agregar `Settings` a los imports de `lucide-react`.
- Agregar un grupo nuevo al final del array `navGroups` (después del grupo `'Análisis'`):
  ```ts
    {
      label: 'Sistema',
      items: [{ href: '/configuracion', label: 'Configuración', icon: Settings }],
    },
  ```

- [ ] **Step 5: Verificar compilación**

Run: `npx tsc --noEmit 2>&1 | grep -E "configuracion|settings/|nav-config" | head`
Expected: sin líneas.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(dashboard)/configuracion/page.tsx" src/components/settings/business-settings-form.tsx src/components/settings/expense-categories-manager.tsx src/components/layout/nav-config.ts
git commit -m "feat(fase4): pagina /configuracion con datos del negocio, talles y categorias + nav"
```

---

### Task 8: Verificación final (build + tests + checkpoints)

**Files:** ninguno (verificación).

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build exitoso, sin errores de TypeScript.

- [ ] **Step 2: Tests unitarios**

Run: `npx vitest run`
Expected: todos verdes (incluye `sizes`, `product-groups`, `purchase-stock`, `deposit`, `size-range`, `category`).

- [ ] **Step 3: Checkpoint manual del usuario — aplicar migración 010**

El usuario aplica `supabase/migrations/010_settings.sql` en el SQL Editor de Supabase (con backup). Crea las tablas, siembra categorías, crea el bucket `business`. Verificar:
```sql
select * from business_settings;
select name from expense_categories order by name;
select id, public from storage.buckets where id = 'business';
```
Expected: una fila en `business_settings` (id=1), las 7 categorías, y el bucket público.

- [ ] **Step 4: Checklist e2e en el navegador** (con la migración aplicada)

1. Ir a **Configuración** → cambiar el nombre del negocio → Guardar → el sidebar muestra el nombre nuevo.
2. Subir un logo → aparece en el sidebar/mobile-nav.
3. Cambiar el rango de talles (ej. 36–44) → Guardar → al cargar/editar un producto, la tabla de talles muestra ese rango.
4. Agregar una categoría (ej. "publicidad"), renombrar otra, borrar una → en **Egresos**, el selector de categoría refleja los cambios; los egresos viejos conservan su etiqueta.

---
