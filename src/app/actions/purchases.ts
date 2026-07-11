'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus, DeliveryStatus } from '@/types/database'
import { sumByVariant } from '@/lib/utils/purchase-stock'

interface PurchaseItemInput {
  variant_id: string
  quantity: number
  unit_cost: number
}

interface CreatePurchaseInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  payment_due_date: string | null
  notes: string | null
  items: PurchaseItemInput[]
}

/**
 * Registra una compra a proveedor: inserta la compra y sus items (con snapshot
 * de nombre y talle) y suma el stock de cada variante.
 */
export async function createPurchase(input: CreatePurchaseInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.supplier_id) return { error: 'Seleccioná un proveedor' }
  if (!input.items?.length) return { error: 'Agregá al menos un producto' }

  const ids = [...new Set(input.items.map(i => i.variant_id))]
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity, products(brand, model, color)')
    .in('id', ids)
  if (varErr) return { error: varErr.message }

  type Row = {
    id: string; size: string; stock_quantity: number
    products: { brand: string; model: string; color: string } | null
  }
  const byId = new Map((variants as unknown as Row[] ?? []).map(v => [v.id, v]))

  const qtyById = new Map<string, number>()
  let total = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.variant_id)) return { error: 'Uno de los productos no existe' }
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
    total += item.unit_cost * item.quantity
  }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .insert({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      total_amount: total,
      payment_status: input.payment_status,
      delivery_status: input.delivery_status,
      payment_due_date: input.payment_due_date,
      notes: input.notes,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'No se pudo registrar la compra' }

  const { error: iErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => {
      const v = byId.get(i.variant_id)!
      return {
        purchase_id: purchase.id,
        variant_id: i.variant_id,
        product_label: v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: v.size,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity,
      }
    })
  )
  if (iErr) {
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: iErr.message }
  }

  if (input.delivery_status === 'recibido') {
    for (const [variantId, qty] of qtyById) {
      const v = byId.get(variantId)!
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: v.stock_quantity + qty })
        .eq('id', variantId)
      if (stockErr) {
        return { error: `Compra registrada, pero falló actualizar el stock: ${stockErr.message}` }
      }
    }
  }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
