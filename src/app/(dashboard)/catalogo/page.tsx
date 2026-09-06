import { createClient } from '@/lib/supabase/server'
import { loadCatalogConfig } from '@/lib/catalog/load'
import { CatalogoClient } from './catalogo-client'

export default async function CatalogoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: products }, { data: suppliers }, { data: profileData }, catalog] = await Promise.all([
    supabase
      .from('products')
      .select('*, suppliers(name), variants:product_variants(*), category:product_categories(id, name, slug, line_id)')
      .order('brand')
      .order('model'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
    loadCatalogConfig(),
  ])

  const isAdmin = (profileData as { role: string } | null)?.role === 'admin'

  return (
    <CatalogoClient
      products={products ?? []}
      suppliers={suppliers ?? []}
      categories={catalog.categories}
      brands={catalog.brands}
      isAdmin={isAdmin}
    />
  )
}
