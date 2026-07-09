import { createClient } from '@/lib/supabase/server'
import { CatalogoClient } from './catalogo-client'

export default async function CatalogoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: products }, { data: suppliers }, { data: profileData }] = await Promise.all([
    supabase.from('products').select('*, suppliers(name)').order('brand').order('model'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
  ])

  const isAdmin = (profileData as { role: string } | null)?.role === 'admin'

  return (
    <CatalogoClient
      products={products ?? []}
      suppliers={suppliers ?? []}
      isAdmin={isAdmin}
    />
  )
}
