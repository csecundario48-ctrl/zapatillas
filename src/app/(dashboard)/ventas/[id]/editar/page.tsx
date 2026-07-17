import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SaleForm, type VariantOption, type SaleForEdit } from '@/components/sales/sale-form'
import type { SaleChannel, SaleStatus, PaymentMethod } from '@/types/database'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

type SaleItemRow = {
  variant_id: string | null
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
}

type SaleRow = {
  id: string
  status: SaleStatus
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  deposit_amount: number
  sale_items: SaleItemRow[]
}

function toOption(v: VariantRow): VariantOption {
  return {
    id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
    brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
    sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
  }
}

export default async function EditarVentaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: saleData } = await supabase
    .from('sales')
    .select('id, status, sale_date, channel, payment_method, customer_id, deposit_amount, sale_items(variant_id, quantity, unit_price, discount, subtotal)')
    .eq('id', id)
    .single()
  if (!saleData) notFound()
  const sale = saleData as unknown as SaleRow

  const saleVariantIds = sale.sale_items
    .map(i => i.variant_id)
    .filter((v): v is string => v !== null)

  // Las variantes de esta venta se cargan aparte de las activas: el producto
  // pudo desactivarse desde entonces, y sin esto desaparecería de su propia venta.
  const [{ data: activeRows }, { data: saleRows }, { data: customers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    saleVariantIds.length
      ? supabase
          .from('product_variants')
          .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)')
          .in('id', saleVariantIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('customers').select('*').order('name'),
  ])

  const byId = new Map<string, VariantOption>()
  for (const v of ((activeRows as unknown as VariantRow[]) ?? []).filter(v => v.products?.active)) {
    byId.set(v.id, toOption(v))
  }
  for (const v of (saleRows as unknown as VariantRow[]) ?? []) {
    if (v.products) byId.set(v.id, toOption(v))
  }

  const orphans = sale.sale_items.filter(i => !i.variant_id)
  const forEdit: SaleForEdit = {
    id: sale.id,
    status: sale.status,
    sale_date: sale.sale_date,
    channel: sale.channel,
    payment_method: sale.payment_method,
    customer_id: sale.customer_id,
    deposit_amount: sale.deposit_amount,
    items: sale.sale_items
      .filter(i => i.variant_id)
      .map(i => ({
        variant_id: i.variant_id as string,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
    orphan: {
      count: orphans.length,
      total: orphans.reduce((sum, i) => sum + i.subtotal, 0),
    },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {sale.status === 'encargo' ? 'Editar encargo' : 'Editar venta'}
      </h1>
      <SaleForm variants={[...byId.values()]} customers={customers ?? []} sale={forEdit} />
    </div>
  )
}
