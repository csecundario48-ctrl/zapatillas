import { createClient } from '@/lib/supabase/server'
import { SaleForm } from '@/components/sales/sale-form'

export default async function NuevaVentaPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('brand')
    .order('model')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Venta</h1>
      <SaleForm products={(products as any) ?? []} />
    </div>
  )
}
