# KALA — Panel de gestión

Sistema de gestión para tienda de zapatillas: ventas, compras, stock, catálogo,
clientes, proveedores, egresos, finanzas y reportes. Next.js 16 (App Router) +
Supabase.

## Requisitos

- **Node.js >= 20.9** (Next 16 no funciona con Node 18)
- Cuenta de Supabase

## Setup

```bash
npm install
cp .env.example .env.local   # completá con tus claves de Supabase
npm run dev
```

Abrí http://localhost:3000.

## Variables de entorno

Ver `.env.example`. Nunca commitees `.env.local` (está en `.gitignore`).
La `SUPABASE_SERVICE_ROLE_KEY` bypassa RLS: es solo para servidor, nunca la
expongas al cliente ni la subas al repo.

## Base de datos: aplicar RLS (importante)

La app escribe a Supabase desde el navegador con la anon key, que es pública.
Sin Row Level Security, cualquiera puede leer/modificar la base sin loguearse.

Aplicá las políticas antes de usar en producción:

1. Supabase Dashboard → SQL Editor
2. Pegá y ejecutá `supabase/migrations/0001_rls_policies.sql`

## Arquitectura

- `src/app/(dashboard)/` — páginas del panel (server components que leen de Supabase)
- `src/app/(auth)/` — login
- `src/app/actions/` — server actions para escrituras críticas:
  - `sales.ts` — registra venta y **descuenta stock** de forma centralizada
  - `purchases.ts` — registra compra y **suma stock**
  - `stock.ts` — ajuste manual de stock
- `src/proxy.ts` — protección de rutas (equivalente a middleware en Next 16)
- `src/components/` — UI. `layout/nav-config.ts` centraliza el menú (sidebar + mobile)

## Scripts

```bash
npm run dev     # desarrollo
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint
```
