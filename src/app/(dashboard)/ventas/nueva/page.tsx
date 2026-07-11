import { createClient } from '@/lib/supabase/server'
import { SaleForm } from '@/components/sales/sale-form'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

export default async function NuevaVentaPage() {
  const supabase = await createClient()
  const [{ data: variantRows }, { data: customers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    supabase.from('customers').select('*').order('name'),
  ])

  const variants = ((variantRows as unknown as VariantRow[]) ?? [])
    .filter(v => v.products?.active)
    .map(v => ({
      id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
      brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
      sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
    }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Nueva Venta</h1>
      <SaleForm variants={variants} customers={customers ?? []} />
    </div>
  )
}
