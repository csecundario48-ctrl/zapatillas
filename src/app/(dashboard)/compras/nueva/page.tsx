import { createClient } from '@/lib/supabase/server'
import { PurchaseForm } from '@/components/purchases/purchase-form'

export default async function NuevaCompraPage() {
  const supabase = await createClient()
  const [{ data: products }, { data: suppliers }] = await Promise.all([
    supabase.from('products').select('*').eq('active', true).order('brand').order('model'),
    supabase.from('suppliers').select('*').order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Compra</h1>
      <PurchaseForm products={(products as any) ?? []} suppliers={(suppliers as any) ?? []} />
    </div>
  )
}
