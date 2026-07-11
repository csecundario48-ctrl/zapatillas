// Vacía los datos del panel para cargar todo de nuevo.
// Usa la service_role key (.env.local), así que ignora RLS. NO borra usuarios.
//
// Uso:
//   node scripts/reset-datos.mjs --movimientos --si   → borra ventas, compras y ajustes de stock
//   node scripts/reset-datos.mjs --productos --si     → además borra todos los productos
//   node scripts/reset-datos.mjs --todo --si          → además egresos, clientes y proveedores
//
// Sin --si solo muestra qué borraría (simulacro).
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]] = m[2]
}

const args = new Set(process.argv.slice(2))
const todo = args.has('--todo')
const productos = todo || args.has('--productos')
const movimientos = productos || args.has('--movimientos')
const confirmado = args.has('--si')

if (!movimientos) {
  console.log('Elegí qué borrar: --movimientos | --productos | --todo (agregá --si para ejecutar)')
  process.exit(1)
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// Orden pensado para respetar las foreign keys.
const plan = []
if (movimientos) plan.push('sale_items', 'sales', 'purchase_items', 'purchases', 'stock_adjustments')
if (todo) plan.push('expenses')
if (productos) plan.push('products')
if (todo) plan.push('customers', 'suppliers')

console.log(confirmado ? 'BORRANDO:' : 'SIMULACRO (agregá --si para borrar de verdad):')
for (const table of plan) {
  const { count } = await admin.from(table).select('*', { count: 'exact', head: true })
  if (!confirmado) {
    console.log(`  ${table}: ${count ?? 0} filas se borrarían`)
    continue
  }
  const { error } = await admin
    .from(table)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    console.error(`  ✗ ${table}: ${error.message}`)
    process.exit(1)
  }
  console.log(`  ✓ ${table}: ${count ?? 0} filas borradas`)
}

if (confirmado) {
  console.log('\nListo. Base vacía para cargar de nuevo (los usuarios quedaron intactos).')
}
