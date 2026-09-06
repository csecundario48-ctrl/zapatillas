import { createClient } from '@/lib/supabase/server'
import { OutfitsClient } from './outfits-client'
import type { PickerProduct } from '@/components/outfits/outfit-product-picker'
import type { Outfit } from '@/types/database'

export default async function OutfitsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: outfits }, { data: products }, { data: profileData }] = await Promise.all([
    supabase
      .from('outfits')
      .select('*, items:outfit_items(id, outfit_id, product_id, sort_order, product:products(id, brand, model, color))')
      .order('favorite', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id, brand, model, color, category:product_categories(name)')
      .eq('active', true)
      .order('brand')
      .order('model'),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
  ])

  const isAdmin = (profileData as { role: string } | null)?.role === 'admin'

  type RawProduct = { id: string; brand: string; model: string; color: string; category: { name: string } | null }
  const pickerProducts: PickerProduct[] = ((products as RawProduct[] | null) ?? []).map(p => ({
    id: p.id, brand: p.brand, model: p.model, color: p.color, categoryName: p.category?.name ?? null,
  }))

  return (
    <OutfitsClient
      outfits={(outfits as Outfit[] | null) ?? []}
      products={pickerProducts}
      isAdmin={isAdmin}
    />
  )
}
