// Verifica y corrige el perfil admin en user_profiles
// Uso: node scripts/fix-admin-profile.mjs <email>
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.+?)\s*$/)
  if (m) env[m[1]] = m[2]
}

const EMAIL = process.argv[2]
if (!EMAIL) {
  console.error('Uso: node scripts/fix-admin-profile.mjs <email>')
  process.exit(1)
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// 1. Buscar el usuario en auth
const { data: list } = await admin.auth.admin.listUsers()
const user = list?.users.find(u => u.email === EMAIL)
if (!user) {
  console.log('ERROR: No existe el usuario', EMAIL, 'en auth.users')
  process.exit(1)
}
console.log('Auth user id:', user.id)

// 2. Verificar user_profiles
const { data: profile, error: profileErr } = await admin
  .from('user_profiles')
  .select('id, role, name')
  .eq('id', user.id)
  .single()

if (profileErr || !profile) {
  console.log('Perfil no encontrado para este user id. Creando...')
  const { error: insertErr } = await admin
    .from('user_profiles')
    .upsert({ id: user.id, name: 'Dueño', role: 'admin' }, { onConflict: 'id' })
  if (insertErr) {
    console.log('ERROR al crear perfil:', insertErr.message)
    process.exit(1)
  }
  console.log('✅ Perfil admin creado con id:', user.id)
} else {
  console.log('Perfil encontrado:', profile)
  if (profile.role !== 'admin') {
    await admin.from('user_profiles').update({ role: 'admin' }).eq('id', user.id)
    console.log('✅ Rol actualizado a admin')
  } else {
    console.log('✅ Perfil OK — role:', profile.role)
  }
}

// 3. Verificar que get_user_role() funcionaría
// Lo hacemos buscando directamente con el id
const { data: check } = await admin
  .from('user_profiles')
  .select('role')
  .eq('id', user.id)
  .single()
console.log('\nVerificación final: role =', check?.role)

// 4. Listar todos los perfiles (para detectar perfiles huérfanos)
const { data: allProfiles } = await admin.from('user_profiles').select('id, role, name')
console.log('\nTodos los perfiles en user_profiles:')
for (const p of allProfiles ?? []) {
  const matched = list?.users.find(u => u.id === p.id)
  console.log(` - ${p.id} | role=${p.role} | name=${p.name} | auth_email=${matched?.email ?? 'HUÉRFANO (no existe en auth)'}`)
}
