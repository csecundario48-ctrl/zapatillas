# Zapatillas Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-stack sneaker business dashboard with stock, sales, purchases, expenses, and analytics — Next.js 15 + Supabase + Vercel, $0 cost.

**Architecture:** Next.js 15 App Router with Server Components for data fetching and Server Actions for mutations. Supabase handles PostgreSQL + Auth + stock triggers. Route groups: `(auth)` for login, `(dashboard)` for all protected pages.

**Tech Stack:** Next.js 15, TypeScript (strict), Supabase JS v2, shadcn/ui, Tailwind CSS, Recharts, React Hook Form, Zod, xlsx, jspdf, Vercel

## Global Constraints

- Node.js 20+ required (24 available)
- TypeScript strict mode
- Monetary values: `numeric(10,2)` in DB, `number` in TS (never float arithmetic — use integer cents if precision needed)
- Dates: ISO string `YYYY-MM-DD` throughout
- `stock_quantity >= 0` enforced by DB CHECK constraint
- SKU format: `BRAND-MODEL-COLOR-SIZE` (uppercase, spaces → hyphens, e.g. `NIKE-AF1-BLANCO-42`)
- Admin sees `cost_price`; vendedor role never receives it (filtered server-side)
- Mobile-first responsive (sidebar collapses on `< md`)
- All pages are Server Components by default; use `"use client"` only for interactive forms/charts

---

## File Map

```
C:\Users\Usuario\Desktop\zapatill\
├── supabase/
│   └── migrations/
│       ├── 001_schema.sql
│       ├── 002_triggers.sql
│       └── 003_rls.sql
├── src/
│   ├── middleware.ts
│   ├── app/
│   │   ├── layout.tsx                  (root)
│   │   ├── (auth)/login/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx              (sidebar + header)
│   │       ├── page.tsx                (Home/KPIs)
│   │       ├── catalogo/page.tsx
│   │       ├── stock/page.tsx
│   │       ├── ventas/
│   │       │   ├── page.tsx
│   │       │   └── nueva/page.tsx
│   │       ├── compras/
│   │       │   ├── page.tsx
│   │       │   └── nueva/page.tsx
│   │       ├── egresos/page.tsx
│   │       ├── finanzas/page.tsx
│   │       └── reportes/page.tsx
│   ├── components/
│   │   ├── layout/sidebar.tsx
│   │   ├── layout/header.tsx
│   │   ├── kpis/kpi-card.tsx
│   │   ├── kpis/alerts-panel.tsx
│   │   ├── products/product-form.tsx
│   │   ├── products/product-table.tsx
│   │   ├── stock/stock-table.tsx
│   │   ├── stock/adjustment-form.tsx
│   │   ├── sales/sale-form.tsx
│   │   ├── sales/sale-history-table.tsx
│   │   ├── purchases/purchase-form.tsx
│   │   ├── expenses/expense-form.tsx
│   │   ├── charts/sales-line-chart.tsx
│   │   ├── charts/brand-pie-chart.tsx
│   │   └── charts/size-bar-chart.tsx
│   ├── lib/
│   │   ├── supabase/client.ts
│   │   ├── supabase/server.ts
│   │   ├── validations/product.ts
│   │   ├── validations/sale.ts
│   │   ├── validations/purchase.ts
│   │   ├── validations/expense.ts
│   │   ├── utils/format.ts
│   │   ├── utils/sku.ts
│   │   ├── utils/sizes.ts
│   │   └── export/excel.ts
│   └── types/database.ts
├── .env.local
└── package.json
```

---

## Task 1: Project Scaffold + Dependencies

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`
- Create: `.env.local`
- Create: `src/app/layout.tsx`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd C:\Users\Usuario\Desktop\zapatill
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --yes
```

Expected: project files created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install react-hook-form @hookform/resolvers zod
npm install recharts
npm install xlsx jspdf jspdf-autotable
npm install date-fns
npm install lucide-react
npm install clsx tailwind-merge
npm install class-variance-authority
```

- [ ] **Step 3: Install shadcn/ui**

```bash
npx shadcn@latest init --defaults
npx shadcn@latest add button input label select table card badge dialog sheet form toast tabs
```

- [ ] **Step 4: Create `.env.local`**

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

(Values come from Supabase dashboard → Project Settings → API)

- [ ] **Step 5: Verify build compiles**

```bash
npm run build
```

Expected: build succeeds, no TypeScript errors.

---

## Task 2: Database Schema (Supabase Migrations)

**Files:**
- Create: `supabase/migrations/001_schema.sql`
- Create: `supabase/migrations/002_triggers.sql`
- Create: `supabase/migrations/003_rls.sql`

- [ ] **Step 1: Create Supabase project**

Go to https://supabase.com → New project → note URL and keys.

- [ ] **Step 2: Run 001_schema.sql in Supabase SQL Editor**

```sql
create extension if not exists "uuid-ossp";

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  brand text not null,
  model text not null,
  color text not null,
  gender text not null check (gender in ('hombre', 'mujer', 'nino', 'unisex')),
  size text not null,
  cost_price numeric(10,2) not null check (cost_price >= 0),
  sale_price numeric(10,2) not null check (sale_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  supplier_id uuid references suppliers(id) on delete set null,
  sku text unique not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

create table sales (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  sale_date date not null default current_date,
  channel text not null check (channel in ('fisica', 'online')),
  total_amount numeric(10,2) not null,
  payment_method text not null check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'mercadopago')),
  status text not null default 'completada' check (status in ('completada', 'cancelada', 'devolucion')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references sales(id) on delete cascade not null,
  product_id uuid references products(id) not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  discount numeric(10,2) default 0,
  subtotal numeric(10,2) not null
);

create table purchases (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id) not null,
  purchase_date date not null default current_date,
  total_amount numeric(10,2) not null,
  payment_status text not null default 'pendiente' check (payment_status in ('pagado', 'pendiente', 'parcial')),
  payment_due_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid references purchases(id) on delete cascade not null,
  product_id uuid references products(id) not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('alquiler','servicios','marketing','delivery','salarios','packaging','otros')),
  type text not null check (type in ('fijo', 'variable')),
  description text,
  amount numeric(10,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text,
  recurring boolean default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) not null,
  quantity_change integer not null,
  reason text not null check (reason in ('ajuste_manual','rotura','perdida','devolucion_proveedor')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'vendedor' check (role in ('admin', 'vendedor')),
  created_at timestamptz default now()
);
```

- [ ] **Step 3: Run 002_triggers.sql**

```sql
create or replace function handle_sale_item_insert()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity - new.quantity where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function handle_sale_item_delete()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity + old.quantity where id = old.product_id;
  return old;
end;
$$ language plpgsql security definer;

create or replace function handle_purchase_item_insert()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity + new.quantity where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function handle_stock_adjustment_insert()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity + new.quantity_change where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_sale_item_insert after insert on sale_items for each row execute function handle_sale_item_insert();
create trigger on_sale_item_delete after delete on sale_items for each row execute function handle_sale_item_delete();
create trigger on_purchase_item_insert after insert on purchase_items for each row execute function handle_purchase_item_insert();
create trigger on_stock_adjustment_insert after insert on stock_adjustments for each row execute function handle_stock_adjustment_insert();
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
```

- [ ] **Step 4: Run 003_rls.sql**

```sql
alter table suppliers enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table expenses enable row level security;
alter table stock_adjustments enable row level security;
alter table user_profiles enable row level security;

create or replace function get_user_role() returns text as $$
  select role from user_profiles where id = auth.uid();
$$ language sql security definer stable;

create policy "auth_read" on suppliers for select to authenticated using (true);
create policy "admin_write" on suppliers for all to authenticated using (get_user_role() = 'admin');
create policy "auth_read" on products for select to authenticated using (true);
create policy "admin_write" on products for all to authenticated using (get_user_role() = 'admin');
create policy "auth_all" on customers for all to authenticated using (true);
create policy "auth_all" on sales for all to authenticated using (true);
create policy "auth_all" on sale_items for all to authenticated using (true);
create policy "admin_all" on purchases for all to authenticated using (get_user_role() = 'admin');
create policy "admin_all" on purchase_items for all to authenticated using (get_user_role() = 'admin');
create policy "admin_all" on expenses for all to authenticated using (get_user_role() = 'admin');
create policy "admin_all" on stock_adjustments for all to authenticated using (get_user_role() = 'admin');
create policy "own_profile" on user_profiles for select to authenticated using (id = auth.uid());
create policy "admin_profiles" on user_profiles for select to authenticated using (get_user_role() = 'admin');
```

- [ ] **Step 5: Create first admin user**

Supabase dashboard → Authentication → Users → Invite user (use the owner's email).
Then in SQL Editor:
```sql
update user_profiles set role = 'admin', name = 'Dueño' where id = '<user-uuid>';
```

- [ ] **Step 6: Verify schema**

Supabase → Table Editor → confirm all 10 tables exist with correct columns.

---

## Task 3: Supabase Clients + Types + Middleware

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/types/database.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Create browser client** (`src/lib/supabase/client.ts`)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 2: Create server client** (`src/lib/supabase/server.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

- [ ] **Step 3: Create middleware** (`src/middleware.ts`)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Create database types** (`src/types/database.ts`)

```typescript
export type Gender = 'hombre' | 'mujer' | 'nino' | 'unisex'
export type SaleChannel = 'fisica' | 'online'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'
export type SaleStatus = 'completada' | 'cancelada' | 'devolucion'
export type PaymentStatus = 'pagado' | 'pendiente' | 'parcial'
export type ExpenseCategory = 'alquiler' | 'servicios' | 'marketing' | 'delivery' | 'salarios' | 'packaging' | 'otros'
export type ExpenseType = 'fijo' | 'variable'
export type AdjustmentReason = 'ajuste_manual' | 'rotura' | 'perdida' | 'devolucion_proveedor'
export type UserRole = 'admin' | 'vendedor'

export interface Supplier {
  id: string; name: string; contact_name: string | null
  phone: string | null; email: string | null; notes: string | null
  created_at: string
}

export interface Product {
  id: string; brand: string; model: string; color: string
  gender: Gender; size: string; cost_price: number; sale_price: number
  stock_quantity: number; supplier_id: string | null; sku: string
  active: boolean; created_at: string
  suppliers?: Supplier
}

export interface Customer {
  id: string; name: string; phone: string | null
  email: string | null; address: string | null; created_at: string
}

export interface Sale {
  id: string; customer_id: string | null; sale_date: string
  channel: SaleChannel; total_amount: number; payment_method: PaymentMethod
  status: SaleStatus; notes: string | null; created_by: string | null; created_at: string
  customers?: Customer; sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string; sale_id: string; product_id: string
  quantity: number; unit_price: number; discount: number; subtotal: number
  products?: Product
}

export interface Purchase {
  id: string; supplier_id: string; purchase_date: string
  total_amount: number; payment_status: PaymentStatus
  payment_due_date: string | null; notes: string | null
  created_by: string | null; created_at: string
  suppliers?: Supplier; purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string; purchase_id: string; product_id: string
  quantity: number; unit_cost: number; subtotal: number
  products?: Product
}

export interface Expense {
  id: string; category: ExpenseCategory; type: ExpenseType
  description: string | null; amount: number; expense_date: string
  payment_method: string | null; recurring: boolean
  notes: string | null; created_by: string | null; created_at: string
}

export interface StockAdjustment {
  id: string; product_id: string; quantity_change: number
  reason: AdjustmentReason; notes: string | null
  created_by: string | null; created_at: string
  products?: Product
}

export interface UserProfile {
  id: string; name: string | null; role: UserRole; created_at: string
}
```

- [ ] **Step 5: Verify middleware redirects**

Run `npm run dev`. Visit `http://localhost:3000` — should redirect to `/login`.

---

## Task 4: Auth — Login Page

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/layout.tsx`

- [ ] **Step 1: Create auth layout** (`src/app/(auth)/layout.tsx`)

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create login page** (`src/app/(auth)/login/page.tsx`)

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl text-center">Zapatillas Dashboard</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Verify login works**

Run `npm run dev`. Visit `/login`, enter admin credentials → should redirect to `/`.

---

## Task 5: Dashboard Layout (Sidebar + Header)

**Files:**
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`

- [ ] **Step 1: Create sidebar** (`src/components/layout/sidebar.tsx`)

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Package, BarChart2, ShoppingCart,
  Truck, Receipt, TrendingUp, FileText, LogOut
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/catalogo', label: 'Catálogo', icon: Package },
  { href: '/stock', label: 'Stock', icon: BarChart2 },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/compras', label: 'Compras', icon: Truck },
  { href: '/egresos', label: 'Egresos', icon: Receipt },
  { href: '/finanzas', label: 'Finanzas', icon: TrendingUp },
  { href: '/reportes', label: 'Reportes', icon: FileText },
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className={cn('flex flex-col w-64 bg-slate-900 text-white min-h-screen', className)}>
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">👟 Zapatillas</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}>
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <button onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-800">
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create dashboard layout** (`src/app/(dashboard)/layout.tsx`)

```typescript
import { Sidebar } from '@/components/layout/sidebar'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 overflow-auto">
        <div className="p-6">{children}</div>
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create placeholder home page** (`src/app/(dashboard)/page.tsx`)

```typescript
export default function HomePage() {
  return <div className="text-2xl font-bold">Dashboard — próximamente</div>
}
```

- [ ] **Step 4: Verify layout renders**

`npm run dev` → login → confirm sidebar appears with all 8 nav items.

---

## Task 6: Utility Functions

**Files:**
- Create: `src/lib/utils/format.ts`
- Create: `src/lib/utils/sku.ts`
- Create: `src/lib/utils/sizes.ts`

- [ ] **Step 1: Create format utils** (`src/lib/utils/format.ts`)

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS', maximumFractionDigits: 0
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatDateForInput(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}
```

- [ ] **Step 2: Create SKU util** (`src/lib/utils/sku.ts`)

```typescript
export function generateSku(brand: string, model: string, color: string, size: string): string {
  const normalize = (s: string) => s.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '')
  return `${normalize(brand)}-${normalize(model)}-${normalize(color)}-${normalize(size)}`
}
```

- [ ] **Step 3: Create sizes util** (`src/lib/utils/sizes.ts`)

```typescript
import type { Gender } from '@/types/database'

const SIZES: Record<Gender, string[]> = {
  hombre:  ['38','39','40','41','42','43','44','45','46'],
  mujer:   ['34','35','36','37','38','39','40','41'],
  nino:    ['22','23','24','25','26','27','28','29','30','31','32','33'],
  unisex:  ['22','23','24','25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46'],
}

export function getSizesForGender(gender: Gender): string[] {
  return SIZES[gender]
}

export const BRANDS = ['Nike','Adidas','Puma','New Balance','Converse','Vans','Fila','Reebok','Asics','Skechers']
export const EXPENSE_CATEGORIES = ['alquiler','servicios','marketing','delivery','salarios','packaging','otros'] as const
```

---

## Task 7: Catálogo — Product CRUD

**Files:**
- Create: `src/lib/validations/product.ts`
- Create: `src/components/products/product-form.tsx`
- Create: `src/components/products/product-table.tsx`
- Create: `src/app/(dashboard)/catalogo/page.tsx`

- [ ] **Step 1: Create product validation** (`src/lib/validations/product.ts`)

```typescript
import { z } from 'zod'

export const productSchema = z.object({
  brand: z.string().min(1, 'Requerido'),
  model: z.string().min(1, 'Requerido'),
  color: z.string().min(1, 'Requerido'),
  gender: z.enum(['hombre', 'mujer', 'nino', 'unisex']),
  size: z.string().min(1, 'Requerido'),
  cost_price: z.coerce.number().min(0, 'Debe ser positivo'),
  sale_price: z.coerce.number().min(0, 'Debe ser positivo'),
  supplier_id: z.string().uuid().nullable().optional(),
  active: z.boolean().default(true),
})

export type ProductFormData = z.infer<typeof productSchema>
```

- [ ] **Step 2: Create product form** (`src/components/products/product-form.tsx`)

```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productSchema, type ProductFormData } from '@/lib/validations/product'
import { generateSku } from '@/lib/utils/sku'
import { getSizesForGender, BRANDS } from '@/lib/utils/sizes'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Gender } from '@/types/database'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ProductFormProps {
  suppliers: { id: string; name: string }[]
  onSuccess?: () => void
}

export function ProductForm({ suppliers, onSuccess }: ProductFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<ProductFormData>({ resolver: zodResolver(productSchema) })

  const gender = watch('gender') as Gender | undefined
  const sizes = gender ? getSizesForGender(gender) : []

  async function onSubmit(data: ProductFormData) {
    setError(null)
    const sku = generateSku(data.brand, data.model, data.color, data.size)
    const supabase = createClient()
    const { error } = await supabase.from('products').insert({ ...data, sku })
    if (error) {
      setError(error.code === '23505' ? 'Ya existe un producto con ese SKU' : error.message)
      return
    }
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Marca</Label>
          <select {...register('brand')} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Seleccionar</option>
            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {errors.brand && <p className="text-xs text-red-500">{errors.brand.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Modelo</Label>
          <Input {...register('model')} placeholder="Air Force 1" />
          {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Color</Label>
          <Input {...register('color')} placeholder="Blanco/Negro" />
          {errors.color && <p className="text-xs text-red-500">{errors.color.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Género</Label>
          <select {...register('gender')} className="w-full border rounded px-3 py-2 text-sm"
            onChange={e => { setValue('gender', e.target.value as Gender); setValue('size', '') }}>
            <option value="">Seleccionar</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
            <option value="nino">Niño</option>
            <option value="unisex">Unisex</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Talle</Label>
          <select {...register('size')} className="w-full border rounded px-3 py-2 text-sm" disabled={!gender}>
            <option value="">Seleccionar</option>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.size && <p className="text-xs text-red-500">{errors.size.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Proveedor</Label>
          <select {...register('supplier_id')} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Sin proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Costo ($)</Label>
          <Input {...register('cost_price')} type="number" step="0.01" />
          {errors.cost_price && <p className="text-xs text-red-500">{errors.cost_price.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Precio de venta ($)</Label>
          <Input {...register('sale_price')} type="number" step="0.01" />
          {errors.sale_price && <p className="text-xs text-red-500">{errors.sale_price.message}</p>}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar producto'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create product table** (`src/components/products/product-table.tsx`)

```typescript
import type { Product } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'

interface ProductTableProps { products: Product[]; isAdmin: boolean }

export function ProductTable({ products, isAdmin }: ProductTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3">SKU</th>
            <th className="text-left p-3">Marca / Modelo</th>
            <th className="text-left p-3">Color</th>
            <th className="text-left p-3">Género</th>
            <th className="text-left p-3">Talle</th>
            {isAdmin && <th className="text-left p-3">Costo</th>}
            <th className="text-left p-3">Precio</th>
            <th className="text-left p-3">Stock</th>
            <th className="text-left p-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs text-gray-500">{p.sku}</td>
              <td className="p-3 font-medium">{p.brand} {p.model}</td>
              <td className="p-3">{p.color}</td>
              <td className="p-3 capitalize">{p.gender}</td>
              <td className="p-3">{p.size}</td>
              {isAdmin && <td className="p-3">{formatCurrency(p.cost_price)}</td>}
              <td className="p-3 font-medium">{formatCurrency(p.sale_price)}</td>
              <td className="p-3">
                <span className={p.stock_quantity === 0 ? 'text-red-600 font-bold' :
                  p.stock_quantity <= 2 ? 'text-yellow-600 font-bold' : 'text-green-700'}>
                  {p.stock_quantity}
                </span>
              </td>
              <td className="p-3">
                <Badge variant={p.active ? 'default' : 'secondary'}>
                  {p.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create catálogo page** (`src/app/(dashboard)/catalogo/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { ProductTable } from '@/components/products/product-table'
import { ProductForm } from '@/components/products/product-form'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default async function CatalogoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: products }, { data: suppliers }, { data: profile }] = await Promise.all([
    supabase.from('products').select('*, suppliers(name)').order('brand').order('model'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
  ])

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
        {isAdmin && (
          <Dialog>
            <DialogTrigger asChild>
              <Button>+ Nuevo producto</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Agregar producto</DialogTitle>
              </DialogHeader>
              <ProductForm suppliers={suppliers ?? []} />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="bg-white rounded-lg border">
        <ProductTable products={products ?? []} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Navigate to `/catalogo`. If admin: "Nuevo producto" button visible. Create a product → appears in table. Stock shows color coding.

---

## Task 8: Stock Management

**Files:**
- Create: `src/components/stock/adjustment-form.tsx`
- Create: `src/app/(dashboard)/stock/page.tsx`

- [ ] **Step 1: Create adjustment form** (`src/components/stock/adjustment-form.tsx`)

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdjustmentReason } from '@/types/database'

interface Props { productId: string; productName: string; currentStock: number; onClose: () => void }

export function AdjustmentForm({ productId, productName, currentStock, onClose }: Props) {
  const router = useRouter()
  const [quantityChange, setQuantityChange] = useState(0)
  const [reason, setReason] = useState<AdjustmentReason>('ajuste_manual')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (currentStock + quantityChange < 0) {
      setError('El stock no puede quedar negativo')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('stock_adjustments').insert({
      product_id: productId, quantity_change: quantityChange, reason, notes: notes || null
    })
    if (error) { setError(error.message); setLoading(false); return }
    router.refresh()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">{productName} — Stock actual: <strong>{currentStock}</strong></p>
      <div className="space-y-1">
        <Label>Cambio de cantidad</Label>
        <Input type="number" value={quantityChange}
          onChange={e => setQuantityChange(Number(e.target.value))}
          placeholder="+5 o -3" />
        <p className="text-xs text-gray-500">Stock resultante: {currentStock + quantityChange}</p>
      </div>
      <div className="space-y-1">
        <Label>Motivo</Label>
        <select value={reason} onChange={e => setReason(e.target.value as AdjustmentReason)}
          className="w-full border rounded px-3 py-2 text-sm">
          <option value="ajuste_manual">Ajuste manual</option>
          <option value="rotura">Rotura</option>
          <option value="perdida">Pérdida</option>
          <option value="devolucion_proveedor">Devolución a proveedor</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label>Notas (opcional)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Confirmar'}</Button>
        <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create stock page** (`src/app/(dashboard)/stock/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'

export default async function StockPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('stock_quantity')

  const critical = products?.filter(p => p.stock_quantity === 0) ?? []
  const low = products?.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 2) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Stock</h1>

      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-red-700 mb-2">🔴 Sin stock ({critical.length})</h2>
          <ul className="space-y-1">
            {critical.map(p => (
              <li key={p.id} className="text-sm text-red-600">{p.brand} {p.model} — {p.color} T{p.size}</li>
            ))}
          </ul>
        </div>
      )}

      {low.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-700 mb-2">🟡 Stock bajo ({low.length})</h2>
          <ul className="space-y-1">
            {low.map(p => (
              <li key={p.id} className="text-sm text-yellow-700">{p.brand} {p.model} — {p.color} T{p.size} ({p.stock_quantity} ud.)</li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left p-3">Producto</th>
            <th className="text-left p-3">Color</th>
            <th className="text-left p-3">Talle</th>
            <th className="text-left p-3">Stock</th>
          </tr></thead>
          <tbody>
            {products?.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-3">{p.brand} {p.model}</td>
                <td className="p-3">{p.color}</td>
                <td className="p-3">{p.size}</td>
                <td className="p-3">
                  <span className={p.stock_quantity === 0 ? 'text-red-600 font-bold' :
                    p.stock_quantity <= 2 ? 'text-yellow-600 font-bold' : 'text-green-700'}>
                    {p.stock_quantity}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Navigate to `/stock`. Create a product with stock 0 → appears in red section. Create one with stock 1 → yellow section.

---

## Task 9: Ventas — Nueva Venta + Historial

**Files:**
- Create: `src/lib/validations/sale.ts`
- Create: `src/components/sales/sale-form.tsx`
- Create: `src/app/(dashboard)/ventas/page.tsx`
- Create: `src/app/(dashboard)/ventas/nueva/page.tsx`

- [ ] **Step 1: Sale validation** (`src/lib/validations/sale.ts`)

```typescript
import { z } from 'zod'

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.coerce.number().min(1),
  unit_price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
})

export const saleSchema = z.object({
  sale_date: z.string().min(1),
  channel: z.enum(['fisica', 'online']),
  payment_method: z.enum(['efectivo', 'transferencia', 'tarjeta', 'mercadopago']),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Agregá al menos un producto'),
})

export type SaleFormData = z.infer<typeof saleSchema>
```

- [ ] **Step 2: Create sale form** (`src/components/sales/sale-form.tsx`)

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { Product } from '@/types/database'

interface SaleItem { product: Product; quantity: number; unit_price: number; discount: number }

export function SaleForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const [items, setItems] = useState<SaleItem[]>([])
  const [channel, setChannel] = useState('fisica')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [saleDate, setSaleDate] = useState(formatDateForInput())
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filteredProducts = products.filter(p =>
    p.active && p.stock_quantity > 0 &&
    `${p.brand} ${p.model} ${p.color} ${p.size}`.toLowerCase().includes(search.toLowerCase())
  )

  function addItem(product: Product) {
    const existing = items.find(i => i.product.id === product.id)
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        setError(`Stock insuficiente para ${product.brand} ${product.model} T${product.size}`)
        return
      }
      setItems(items.map(i => i.product.id === product.id
        ? { ...i, quantity: i.quantity + 1 }
        : i
      ))
    } else {
      setItems([...items, { product, quantity: 1, unit_price: product.sale_price, discount: 0 }])
    }
    setSearch('')
    setError(null)
  }

  function removeItem(productId: string) {
    setItems(items.filter(i => i.product.id !== productId))
  }

  const total = items.reduce((sum, i) => sum + (i.unit_price - i.discount) * i.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setLoading(true)
    const supabase = createClient()

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({ sale_date: saleDate, channel, payment_method: paymentMethod, total_amount: total, status: 'completada' })
      .select().single()

    if (saleError) { setError(saleError.message); setLoading(false); return }

    const saleItems = items.map(i => ({
      sale_id: sale.id,
      product_id: i.product.id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
      subtotal: (i.unit_price - i.discount) * i.quantity,
    }))

    const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
    if (itemsError) { setError(itemsError.message); setLoading(false); return }

    router.push('/ventas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Canal</Label>
          <select value={channel} onChange={e => setChannel(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            <option value="fisica">Física</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Pago</Label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="mercadopago">MercadoPago</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Buscar producto</Label>
        <Input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Nike Air Force 1 Blanco 42..." />
        {search && (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {filteredProducts.slice(0, 8).map(p => (
              <button key={p.id} type="button" onClick={() => addItem(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between">
                <span>{p.brand} {p.model} — {p.color} T{p.size}</span>
                <span className="text-gray-500">Stock: {p.stock_quantity} | {formatCurrency(p.sale_price)}</span>
              </button>
            ))}
            {filteredProducts.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">Sin resultados</p>}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b">
              <th className="text-left p-3">Producto</th>
              <th className="text-left p-3">Cant.</th>
              <th className="text-left p-3">Precio</th>
              <th className="text-left p-3">Subtotal</th>
              <th className="p-3"></th>
            </tr></thead>
            <tbody>
              {items.map(item => (
                <tr key={item.product.id} className="border-b">
                  <td className="p-3">{item.product.brand} {item.product.model} T{item.product.size}</td>
                  <td className="p-3">
                    <Input type="number" min={1} max={item.product.stock_quantity}
                      value={item.quantity} className="w-16"
                      onChange={e => setItems(items.map(i =>
                        i.product.id === item.product.id
                          ? { ...i, quantity: Math.min(Number(e.target.value), item.product.stock_quantity) }
                          : i
                      ))} />
                  </td>
                  <td className="p-3">{formatCurrency(item.unit_price)}</td>
                  <td className="p-3 font-medium">{formatCurrency((item.unit_price - item.discount) * item.quantity)}</td>
                  <td className="p-3">
                    <button type="button" onClick={() => removeItem(item.product.id)}
                      className="text-red-500 hover:text-red-700 text-xs">Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-gray-50">
              <td colSpan={3} className="p-3 text-right font-bold">Total:</td>
              <td className="p-3 font-bold text-lg">{formatCurrency(total)}</td>
              <td></td>
            </tr></tfoot>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading || items.length === 0} className="w-full">
        {loading ? 'Registrando venta...' : `Confirmar venta — ${formatCurrency(total)}`}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create nueva venta page** (`src/app/(dashboard)/ventas/nueva/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { SaleForm } from '@/components/sales/sale-form'

export default async function NuevaVentaPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('brand').order('model')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Venta</h1>
      <SaleForm products={products ?? []} />
    </div>
  )
}
```

- [ ] **Step 4: Create ventas historial page** (`src/app/(dashboard)/ventas/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'

const statusColor: Record<string, string> = {
  completada: 'default', cancelada: 'destructive', devolucion: 'secondary'
}

export default async function VentasPage() {
  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name), sale_items(id)')
    .order('created_at', { ascending: false })
    .limit(100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Ventas</h1>
        <Link href="/ventas/nueva"><Button>+ Nueva venta</Button></Link>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left p-3">Fecha</th>
            <th className="text-left p-3">Canal</th>
            <th className="text-left p-3">Pago</th>
            <th className="text-left p-3">Total</th>
            <th className="text-left p-3">Estado</th>
          </tr></thead>
          <tbody>
            {sales?.map(sale => (
              <tr key={sale.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{formatDate(sale.sale_date)}</td>
                <td className="p-3 capitalize">{sale.channel}</td>
                <td className="p-3 capitalize">{sale.payment_method}</td>
                <td className="p-3 font-medium">{formatCurrency(sale.total_amount)}</td>
                <td className="p-3">
                  <Badge variant={statusColor[sale.status] as any}>{sale.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Go to `/ventas/nueva`. Search for a product → appears in dropdown. Add to sale → item table shows. Confirm → redirects to `/ventas`, sale appears. Check `/stock` → stock_quantity decreased.

---

## Task 10: Compras a Proveedores

**Files:**
- Create: `src/lib/validations/purchase.ts`
- Create: `src/components/purchases/purchase-form.tsx`
- Create: `src/app/(dashboard)/compras/page.tsx`
- Create: `src/app/(dashboard)/compras/nueva/page.tsx`

- [ ] **Step 1: Purchase validation** (`src/lib/validations/purchase.ts`)

```typescript
import { z } from 'zod'

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid('Seleccioná un proveedor'),
  purchase_date: z.string().min(1),
  payment_status: z.enum(['pagado', 'pendiente', 'parcial']),
  payment_due_date: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().min(1),
    unit_cost: z.coerce.number().min(0),
  })).min(1, 'Agregá al menos un producto'),
})

export type PurchaseFormData = z.infer<typeof purchaseSchema>
```

- [ ] **Step 2: Create purchase form** (`src/components/purchases/purchase-form.tsx`)

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { Product, Supplier } from '@/types/database'

interface PurchaseItem { product: Product; quantity: number; unit_cost: number }

export function PurchaseForm({ products, suppliers }: { products: Product[]; suppliers: Supplier[] }) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(formatDateForInput())
  const [paymentStatus, setPaymentStatus] = useState('pendiente')
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filteredProducts = products.filter(p =>
    `${p.brand} ${p.model} ${p.color} ${p.size}`.toLowerCase().includes(search.toLowerCase())
  )

  function addItem(product: Product) {
    if (items.find(i => i.product.id === product.id)) return
    setItems([...items, { product, quantity: 1, unit_cost: product.cost_price }])
    setSearch('')
  }

  const total = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('Seleccioná un proveedor'); return }
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setLoading(true)
    const supabase = createClient()

    const { data: purchase, error: pErr } = await supabase
      .from('purchases')
      .insert({
        supplier_id: supplierId, purchase_date: purchaseDate,
        total_amount: total, payment_status: paymentStatus,
        payment_due_date: paymentDueDate || null,
      })
      .select().single()

    if (pErr) { setError(pErr.message); setLoading(false); return }

    const { error: iErr } = await supabase.from('purchase_items').insert(
      items.map(i => ({
        purchase_id: purchase.id, product_id: i.product.id,
        quantity: i.quantity, unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity,
      }))
    )

    if (iErr) { setError(iErr.message); setLoading(false); return }
    router.push('/compras')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Proveedor</Label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            <option value="">Seleccionar</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Fecha de compra</Label>
          <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Estado de pago</Label>
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm">
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="parcial">Parcial</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Vencimiento pago</Label>
          <Input type="date" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Buscar producto</Label>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nike Air Force 1..." />
        {search && (
          <div className="border rounded-lg divide-y max-h-40 overflow-y-auto">
            {filteredProducts.slice(0, 8).map(p => (
              <button key={p.id} type="button" onClick={() => addItem(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm">
                {p.brand} {p.model} — {p.color} T{p.size} (costo: {formatCurrency(p.cost_price)})
              </button>
            ))}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3">Producto</th>
            <th className="text-left p-3">Cant.</th>
            <th className="text-left p-3">Costo unit.</th>
            <th className="text-left p-3">Subtotal</th>
          </tr></thead>
          <tbody>
            {items.map(item => (
              <tr key={item.product.id} className="border-b">
                <td className="p-3">{item.product.brand} {item.product.model} T{item.product.size}</td>
                <td className="p-3">
                  <Input type="number" min={1} value={item.quantity} className="w-16"
                    onChange={e => setItems(items.map(i =>
                      i.product.id === item.product.id ? { ...i, quantity: Number(e.target.value) } : i
                    ))} />
                </td>
                <td className="p-3">
                  <Input type="number" min={0} step="0.01" value={item.unit_cost} className="w-28"
                    onChange={e => setItems(items.map(i =>
                      i.product.id === item.product.id ? { ...i, unit_cost: Number(e.target.value) } : i
                    ))} />
                </td>
                <td className="p-3">{formatCurrency(item.unit_cost * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="bg-gray-50">
            <td colSpan={3} className="p-3 text-right font-bold">Total:</td>
            <td className="p-3 font-bold">{formatCurrency(total)}</td>
          </tr></tfoot>
        </table>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Registrar compra'}</Button>
    </form>
  )
}
```

- [ ] **Step 3: Compras pages** — create `nueva/page.tsx` and `page.tsx` following same pattern as ventas (server component fetching data → passing to client form).

`src/app/(dashboard)/compras/nueva/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import { PurchaseForm } from '@/components/purchases/purchase-form'

export default async function NuevaCompraPage() {
  const supabase = await createClient()
  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).order('brand'),
    supabase.from('suppliers').select('*').order('name'),
  ])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Compra</h1>
      <PurchaseForm products={products ?? []} suppliers={suppliers ?? []} />
    </div>
  )
}
```

`src/app/(dashboard)/compras/page.tsx`:
```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'

export default async function ComprasPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  const { data: purchases } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Compras</h1>
        <Link href="/compras/nueva"><Button>+ Nueva compra</Button></Link>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left p-3">Fecha</th>
            <th className="text-left p-3">Proveedor</th>
            <th className="text-left p-3">Total</th>
            <th className="text-left p-3">Pago</th>
            <th className="text-left p-3">Vencimiento</th>
          </tr></thead>
          <tbody>
            {purchases?.map(p => (
              <tr key={p.id} className="border-b">
                <td className="p-3">{formatDate(p.purchase_date)}</td>
                <td className="p-3">{(p.suppliers as any)?.name}</td>
                <td className="p-3 font-medium">{formatCurrency(p.total_amount)}</td>
                <td className="p-3">
                  <Badge variant={p.payment_status === 'pagado' ? 'default' : 'destructive'}>
                    {p.payment_status}
                  </Badge>
                </td>
                <td className="p-3">
                  {p.payment_due_date && (
                    <span className={p.payment_due_date < today && p.payment_status !== 'pagado'
                      ? 'text-red-600 font-bold' : ''}>
                      {formatDate(p.payment_due_date)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Register a purchase → stock increases on `/stock`. Overdue unpaid purchase shows red date.

---

## Task 11: Egresos

**Files:**
- Create: `src/lib/validations/expense.ts`
- Create: `src/components/expenses/expense-form.tsx`
- Create: `src/app/(dashboard)/egresos/page.tsx`

- [ ] **Step 1: Expense validation** (`src/lib/validations/expense.ts`)

```typescript
import { z } from 'zod'

export const expenseSchema = z.object({
  category: z.enum(['alquiler','servicios','marketing','delivery','salarios','packaging','otros']),
  type: z.enum(['fijo', 'variable']),
  description: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Debe ser mayor a 0'),
  expense_date: z.string().min(1),
  payment_method: z.string().optional(),
  recurring: z.boolean().default(false),
  notes: z.string().optional(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
```

- [ ] **Step 2: Expense form** (`src/components/expenses/expense-form.tsx`)

```typescript
'use client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { expenseSchema, type ExpenseFormData } from '@/lib/validations/expense'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatDateForInput } from '@/lib/utils/format'
import { EXPENSE_CATEGORIES } from '@/lib/utils/sizes'

export function ExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { expense_date: formatDateForInput(), recurring: false }
  })

  async function onSubmit(data: ExpenseFormData) {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').insert(data)
    if (error) { setError(error.message); return }
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Categoría</Label>
          <select {...register('category')} className="w-full border rounded px-3 py-2 text-sm">
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <select {...register('type')} className="w-full border rounded px-3 py-2 text-sm">
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Descripción</Label>
          <Input {...register('description')} placeholder="Alquiler local enero" />
        </div>
        <div className="space-y-1">
          <Label>Monto ($)</Label>
          <Input {...register('amount')} type="number" step="0.01" />
          {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input {...register('expense_date')} type="date" />
        </div>
        <div className="space-y-1">
          <Label>Medio de pago</Label>
          <select {...register('payment_method')} className="w-full border rounded px-3 py-2 text-sm">
            <option value="">-</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" {...register('recurring')} />
        Gasto recurrente mensual
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Registrar egreso'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Egresos page** (`src/app/(dashboard)/egresos/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'

export default async function EgresosPage() {
  const supabase = await createClient()
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Egresos</h1>
          <p className="text-gray-500 text-sm">Total registrado: {formatCurrency(total)}</p>
        </div>
        <Dialog>
          <DialogTrigger asChild><Button>+ Nuevo egreso</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar egreso</DialogTitle></DialogHeader>
            <ExpenseForm />
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b bg-gray-50">
            <th className="text-left p-3">Fecha</th>
            <th className="text-left p-3">Categoría</th>
            <th className="text-left p-3">Descripción</th>
            <th className="text-left p-3">Tipo</th>
            <th className="text-left p-3">Monto</th>
            <th className="text-left p-3">Recurrente</th>
          </tr></thead>
          <tbody>
            {expenses?.map(e => (
              <tr key={e.id} className="border-b">
                <td className="p-3">{formatDate(e.expense_date)}</td>
                <td className="p-3 capitalize">{e.category}</td>
                <td className="p-3">{e.description}</td>
                <td className="p-3"><Badge variant="outline">{e.type}</Badge></td>
                <td className="p-3 font-medium">{formatCurrency(e.amount)}</td>
                <td className="p-3">{e.recurring ? '✓' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Register an expense → appears in table. Total updates.

---

## Task 12: Home KPIs + Finanzas

**Files:**
- Create: `src/components/kpis/kpi-card.tsx`
- Modify: `src/app/(dashboard)/page.tsx`
- Create: `src/app/(dashboard)/finanzas/page.tsx`

- [ ] **Step 1: KPI card component** (`src/components/kpis/kpi-card.tsx`)

```typescript
interface KpiCardProps { title: string; value: string; subtitle?: string; color?: string }

export function KpiCard({ title, value, subtitle, color = 'blue' }: KpiCardProps) {
  const colors: Record<string, string> = {
    blue: 'border-l-blue-500', green: 'border-l-green-500',
    yellow: 'border-l-yellow-500', red: 'border-l-red-500',
  }
  return (
    <div className={`bg-white rounded-lg border border-l-4 ${colors[color]} p-5`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Home page with KPIs** (`src/app/(dashboard)/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/kpis/kpi-card'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const supabase = await createClient()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const [
    { data: monthlySales },
    { data: monthlyExpenses },
    { data: stockAlerts },
    { data: overduePurchases },
    { data: topProducts },
  ] = await Promise.all([
    supabase.from('sales').select('total_amount, sale_items(quantity, unit_price, discount, product_id, products(cost_price))')
      .eq('status', 'completada').gte('sale_date', monthStart),
    supabase.from('expenses').select('amount').gte('expense_date', monthStart),
    supabase.from('products').select('id').eq('active', true).lte('stock_quantity', 2),
    supabase.from('purchases').select('id')
      .neq('payment_status', 'pagado').lt('payment_due_date', now.toISOString().split('T')[0]),
    supabase.from('sale_items').select('product_id, quantity, products(brand, model, size)')
      .gte('sales.sale_date', monthStart).limit(5),
  ])

  const totalIncome = monthlySales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const totalCOGS = monthlySales?.reduce((s, sale) =>
    s + (sale.sale_items as any[]).reduce((si: number, item: any) =>
      si + (item.products?.cost_price ?? 0) * item.quantity, 0), 0) ?? 0
  const totalExpenses = monthlyExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const grossProfit = totalIncome - totalCOGS
  const netProfit = grossProfit - totalExpenses

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Resumen del mes</h1>
        <Link href="/ventas/nueva"><Button>+ Nueva venta</Button></Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Ventas del mes" value={formatCurrency(totalIncome)} color="blue" />
        <KpiCard title="Ganancia bruta" value={formatCurrency(grossProfit)} color="green" />
        <KpiCard title="Ganancia neta" value={formatCurrency(netProfit)}
          color={netProfit >= 0 ? 'green' : 'red'} />
        <KpiCard title="Alertas de stock" value={String(stockAlerts?.length ?? 0)}
          subtitle="productos con stock ≤ 2"
          color={stockAlerts && stockAlerts.length > 0 ? 'yellow' : 'blue'} />
      </div>

      {(overduePurchases?.length ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">
            💸 {overduePurchases!.length} pago{overduePurchases!.length > 1 ? 's' : ''} a proveedor vencido{overduePurchases!.length > 1 ? 's' : ''}.{' '}
            <Link href="/compras" className="underline">Ver compras</Link>
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Finanzas page** (`src/app/(dashboard)/finanzas/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils/format'

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: expenses }, { data: purchases }] = await Promise.all([
    supabase.from('sales').select('total_amount, sale_date, sale_items(quantity, products(cost_price))')
      .eq('status', 'completada').order('sale_date'),
    supabase.from('expenses').select('amount, expense_date, category').order('expense_date'),
    supabase.from('purchases').select('total_amount, payment_status').eq('payment_status', 'pendiente'),
  ])

  const totalIncome = sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const totalCOGS = sales?.reduce((s, sale) =>
    s + (sale.sale_items as any[]).reduce((si: number, item: any) =>
      si + (item.products?.cost_price ?? 0) * item.quantity, 0), 0) ?? 0
  const pendingPayments = purchases?.reduce((s, p) => s + p.total_amount, 0) ?? 0
  const netProfit = totalIncome - totalCOGS - totalExpenses

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Finanzas</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Ingresos totales</p>
          <p className="text-3xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Egresos + Costo mercadería</p>
          <p className="text-3xl font-bold text-red-500">{formatCurrency(totalExpenses + totalCOGS)}</p>
        </div>
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Ganancia neta</p>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>
      </div>
      {pendingPayments > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">Pagos pendientes a proveedores: <strong>{formatCurrency(pendingPayments)}</strong></p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify**

Register a sale → Home shows updated monthly income. Register an expense → net profit decreases.

---

## Task 13: Reportes con Gráficos

**Files:**
- Create: `src/components/charts/sales-line-chart.tsx`
- Create: `src/components/charts/brand-pie-chart.tsx`
- Create: `src/app/(dashboard)/reportes/page.tsx`
- Create: `src/lib/export/excel.ts`

- [ ] **Step 1: Sales line chart** (`src/components/charts/sales-line-chart.tsx`)

```typescript
'use client'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DataPoint { month: string; total: number }

export function SalesLineChart({ data }: { data: DataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => formatCurrency(v)} />
        <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 2: Brand pie chart** (`src/components/charts/brand-pie-chart.tsx`)

```typescript
'use client'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6']

export function BrandPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}
```

- [ ] **Step 3: Excel export util** (`src/lib/export/excel.ts`)

```typescript
import * as XLSX from 'xlsx'

export function exportToExcel(data: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Datos')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
```

- [ ] **Step 4: Reportes page** (`src/app/(dashboard)/reportes/page.tsx`)

```typescript
import { createClient } from '@/lib/supabase/server'
import { SalesLineChart } from '@/components/charts/sales-line-chart'
import { BrandPieChart } from '@/components/charts/brand-pie-chart'

export default async function ReportesPage() {
  const supabase = await createClient()

  const { data: salesRaw } = await supabase
    .from('sales')
    .select('sale_date, total_amount, sale_items(quantity, products(brand))')
    .eq('status', 'completada')
    .order('sale_date')

  // Group sales by month
  const byMonth: Record<string, number> = {}
  const byBrand: Record<string, number> = {}

  salesRaw?.forEach(sale => {
    const month = sale.sale_date.slice(0, 7) // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + sale.total_amount;
    (sale.sale_items as any[]).forEach((item: any) => {
      const brand = item.products?.brand ?? 'Otro'
      byBrand[brand] = (byBrand[brand] ?? 0) + item.quantity
    })
  })

  const monthData = Object.entries(byMonth).map(([month, total]) => ({ month, total }))
  const brandData = Object.entries(byBrand).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Reportes y Análisis</h1>
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Ventas por mes</h2>
        <SalesLineChart data={monthData} />
      </div>
      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Unidades vendidas por marca</h2>
        <BrandPieChart data={brandData} />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Verify**

Add several sales across different months → line chart shows data points. Sales of multiple brands → pie chart shows breakdown.

---

## Task 14: Deploy to Vercel

- [ ] **Step 1: Initialize git**

```bash
cd C:\Users\Usuario\Desktop\zapatill
git init
git add .
git commit -m "feat: initial dashboard implementation"
```

- [ ] **Step 2: Push to GitHub**

Create a new repo at github.com → then:
```bash
git remote add origin https://github.com/<username>/zapatillas-dashboard.git
git branch -M main
git push -u origin main
```

- [ ] **Step 3: Deploy to Vercel**

Go to vercel.com → New Project → Import from GitHub → select repo.

In Vercel project settings → Environment Variables, add:
```
NEXT_PUBLIC_SUPABASE_URL = <from Supabase>
NEXT_PUBLIC_SUPABASE_ANON_KEY = <from Supabase>
SUPABASE_SERVICE_ROLE_KEY = <from Supabase>
```

- [ ] **Step 4: Verify production**

Open the Vercel deployment URL. Login, create a product, register a sale. Confirm stock updates. Test on mobile browser.

---

## Verification Checklist

- [ ] Login with admin email → access all 8 sections
- [ ] Login with vendedor email → blocked from /finanzas, /compras, /egresos
- [ ] Create a product → appears in catálogo with correct SKU
- [ ] Attempt to create duplicate SKU → blocked with error
- [ ] Register a sale → stock decreases automatically
- [ ] Try to sell more than stock available → blocked with error
- [ ] Register a purchase → stock increases automatically
- [ ] Stock page shows 🔴 for 0-stock items, 🟡 for 1-2 stock
- [ ] Home KPIs show correct monthly totals
- [ ] Overdue unpaid purchase → warning on home
- [ ] Charts render on mobile without horizontal overflow
- [ ] Export to Excel downloads a file with correct data
