import { createClient } from '@/lib/supabase/server'
import { SaleForm } from '@/components/sales/sale-form'
import type { Customer, Product } from '@/types/database'

export default async function NuevaVentaPage() {
  const supabase = await createClient()
  const [{ data: products }, { data: customers }] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('active', true)
      .gt('stock_quantity', 0)
      .order('brand')
      .order('model'),
    supabase.from('customers').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Venta</h1>
      <SaleForm
        products={(products ?? []) as Product[]}
        customers={(customers ?? []) as Pick<Customer, 'id' | 'name'>[]}
      />
    </div>
  )
}
