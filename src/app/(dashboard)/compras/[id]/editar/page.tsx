import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PurchaseForm, type PurchaseForEdit } from '@/components/purchases/purchase-form'
import { type VariantOption } from '@/components/sales/sale-form'
import type { PaymentStatus, DeliveryStatus } from '@/types/database'

type VariantRow = {
  id: string; product_id: string; size: string; stock_quantity: number
  products: { brand: string; model: string; color: string; sale_price: number; cost_price: number; active: boolean } | null
}

type PurchaseItemRow = {
  variant_id: string | null
  quantity: number
  unit_cost: number
  subtotal: number
}

type PurchaseRow = {
  id: string
  delivery_status: DeliveryStatus
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  purchase_items: PurchaseItemRow[]
}

function toOption(v: VariantRow): VariantOption {
  return {
    id: v.id, product_id: v.product_id, size: v.size, stock_quantity: v.stock_quantity,
    brand: v.products!.brand, model: v.products!.model, color: v.products!.color,
    sale_price: v.products!.sale_price, cost_price: v.products!.cost_price,
  }
}

export default async function EditarCompraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: purchaseData } = await supabase
    .from('purchases')
    .select('id, delivery_status, supplier_id, purchase_date, payment_status, payment_due_date, notes, purchase_items(variant_id, quantity, unit_cost, subtotal)')
    .eq('id', id)
    .single()
  if (!purchaseData) notFound()
  const purchase = purchaseData as unknown as PurchaseRow

  const purchaseVariantIds = purchase.purchase_items
    .map(i => i.variant_id)
    .filter((v): v is string => v !== null)

  // Igual que en ventas: las variantes de esta compra se cargan aparte de las
  // activas, para que un producto desactivado no desaparezca de su propia compra.
  const [{ data: activeRows }, { data: purchaseRows }, { data: suppliers }] = await Promise.all([
    supabase
      .from('product_variants')
      .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)'),
    purchaseVariantIds.length
      ? supabase
          .from('product_variants')
          .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, sale_price, cost_price, active)')
          .in('id', purchaseVariantIds)
      : Promise.resolve({ data: [] as unknown[] }),
    supabase.from('suppliers').select('*').order('name'),
  ])

  const byId = new Map<string, VariantOption>()
  for (const v of ((activeRows as unknown as VariantRow[]) ?? []).filter(v => v.products?.active)) {
    byId.set(v.id, toOption(v))
  }
  for (const v of (purchaseRows as unknown as VariantRow[]) ?? []) {
    if (v.products) byId.set(v.id, toOption(v))
  }

  const orphans = purchase.purchase_items.filter(i => !i.variant_id)
  const forEdit: PurchaseForEdit = {
    id: purchase.id,
    delivery_status: purchase.delivery_status,
    supplier_id: purchase.supplier_id,
    purchase_date: purchase.purchase_date,
    payment_status: purchase.payment_status,
    payment_due_date: purchase.payment_due_date,
    notes: purchase.notes,
    items: purchase.purchase_items
      .filter(i => i.variant_id)
      .map(i => ({
        variant_id: i.variant_id as string,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    orphan: {
      count: orphans.length,
      total: orphans.reduce((sum, i) => sum + i.subtotal, 0),
    },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Editar compra</h1>
      <PurchaseForm variants={[...byId.values()]} suppliers={suppliers ?? []} purchase={forEdit} />
    </div>
  )
}
