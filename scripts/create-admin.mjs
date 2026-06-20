// Crea el usuario admin correctamente vía la Admin API de Supabase.
// Uso: node scripts/create-admin.mjs <email> <password>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]] = m[2]
}

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY

const EMAIL = process.argv[2] || 'csecundario48@gmail.com'
const PASSWORD = process.argv[3] || 'Zapatillas1'

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } })

console.log('Creando usuario:', EMAIL)
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { name: 'Dueño' },
})
if (createErr) {
  console.log('ERROR creando usuario:', JSON.stringify(createErr, null, 2))
  process.exit(1)
}
const userId = created.user.id
console.log('Usuario creado. id:', userId)

// Asegurar el perfil con rol admin (el trigger crea la fila con rol vendedor por defecto)
const { error: upsertErr } = await admin
  .from('user_profiles')
  .upsert({ id: userId, name: 'Dueño', role: 'admin' }, { onConflict: 'id' })
if (upsertErr) {
  console.log('ERROR seteando rol admin:', JSON.stringify(upsertErr, null, 2))
  process.exit(1)
}
console.log('Perfil admin OK.')

// Verificar el login real
console.log('\nVerificando login...')
const anon = createClient(URL_, ANON)
const { data: signIn, error: signInErr } = await anon.auth.signInWithPassword({
  email: EMAIL,
  password: PASSWORD,
})
if (signInErr) {
  console.log('LOGIN FALLÓ:', JSON.stringify({ message: signInErr.message, status: signInErr.status }, null, 2))
  process.exit(1)
}
console.log('✅ LOGIN OK! Ya podés entrar con:')
console.log('   Email:', EMAIL)
console.log('   Password:', PASSWORD)
