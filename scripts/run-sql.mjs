#!/usr/bin/env node
// Ejecuta un archivo .sql contra la base de Supabase usando la conexión directa.
//
// Uso:
//   node --env-file=.env.local scripts/run-sql.mjs supabase/migrations/010_settings.sql
//
// Requiere la variable de entorno SUPABASE_DB_URL con la connection string
// (Session pooler) de Supabase. Ponela en .env.local (que está gitignoreado):
//   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres
//
// El script NUNCA imprime la connection string. Corre el archivo tal cual
// (las migraciones ya traen su propio begin/commit).

import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) {
  console.error('Falta el archivo .sql.\nUso: node --env-file=.env.local scripts/run-sql.mjs <ruta.sql>')
  process.exit(1)
}

const connectionString = process.env.SUPABASE_DB_URL
if (!connectionString) {
  console.error(
    'Falta SUPABASE_DB_URL. Agregala a .env.local con la connection string (Session pooler) de Supabase\n' +
    'y corré con: node --env-file=.env.local scripts/run-sql.mjs <ruta.sql>'
  )
  process.exit(1)
}

const sql = readFileSync(file, 'utf8')

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  console.log(`▶ Ejecutando ${file} ...`)
  const result = await client.query(sql)
  const results = Array.isArray(result) ? result : [result]
  for (const r of results) {
    if (r.command === 'SELECT' && r.rows?.length) {
      console.table(r.rows)
    } else if (r.command) {
      console.log(`  ${r.command}${typeof r.rowCount === 'number' ? ` (${r.rowCount} filas)` : ''}`)
    }
  }
  console.log('✓ OK')
} catch (err) {
  console.error(`✗ Error: ${err.message}`)
  process.exitCode = 1
} finally {
  await client.end()
}
