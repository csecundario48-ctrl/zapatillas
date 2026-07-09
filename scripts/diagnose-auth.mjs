// Diagnóstico de autenticación — lee .env.local, intenta login y revisa el estado.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Parse .env.local
const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]] = m[2]
}

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY

const EMAIL = process.argv[2]
const PASSWORD = process.argv[3]
if (!EMAIL || !PASSWORD) {
  console.error('Uso: node scripts/diagnose-auth.mjs <email> <password>')
  process.exit(1)
}

console.log('URL:', URL_)
console.log('Email a probar:', EMAIL)
console.log('================================================\n')

// 1. Intentar login con anon key (reproduce el flujo real)
console.log('1) Intentando signInWithPassword...')
const anon = createClient(URL_, ANON)
const { data: signInData, error: signInErr } = await anon.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
if (signInErr) {
  console.log('   ERROR:', JSON.stringify({ message: signInErr.message, status: signInErr.status, code: signInErr.code }, null, 2))
} else {
  console.log('   LOGIN OK! user id:', signInData.user?.id)
}

// 2. Con service role, revisar triggers sobre auth.users y estado del usuario
console.log('\n2) Estado vía service_role...')
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

// Listar usuarios (admin API)
const { data: list, error: listErr } = await admin.auth.admin.listUsers()
if (listErr) {
  console.log('   listUsers ERROR:', listErr.message)
} else {
  console.log('   Total usuarios:', list.users.length)
  for (const u of list.users) {
    console.log(`   - ${u.email} | id=${u.id} | confirmed=${!!u.email_confirmed_at} | identities=${u.identities?.length ?? 0}`)
  }
}
