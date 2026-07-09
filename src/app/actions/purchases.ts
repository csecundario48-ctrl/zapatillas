'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus } from '@/types/database'

interface PurchaseItemInput {
  product_id: string
  quantity: number
  unit_cost: number
}

interface CreatePurchaseInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  items: PurchaseItemInput[]
}

/**
 * Registra una compra a proveedor: inserta la compra y sus items, y suma el
 * stock de cada producto. Si falla la carga de items, revierte la compra.
 * Setea created_by con el usuario autenticado.
 */
export async function createPurchase(input: CreatePurchaseInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.supplier_id) return { error: 'Seleccioná un proveedor' }
  if (!input.items?.length) return { error: 'Agregá al menos un producto' }

  const ids = [...new Set(input.items.map(i => i.product_id))]
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, stock_quantity')
    .in('id', ids)
  if (prodErr) return { error: prodErr.message }

  const byId = new Map((products ?? []).map(p => [p.id, p]))

  const qtyById = new Map<string, number>()
  let total = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.product_id)) return { error: 'Uno de los productos no existe' }
    qtyById.set(item.product_id, (qtyById.get(item.product_id) ?? 0) + item.quantity)
    total += item.unit_cost * item.quantity
  }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .insert({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      total_amount: total,
      payment_status: input.payment_status,
      payment_due_date: input.payment_due_date,
      notes: input.notes,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'No se pudo registrar la compra' }

  const { error: iErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => ({
      purchase_id: purchase.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.unit_cost * i.quantity,
    }))
  )
  if (iErr) {
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: iErr.message }
  }

  for (const [productId, qty] of qtyById) {
    const p = byId.get(productId)!
    const { error: stockErr } = await supabase
      .from('products')
      .update({ stock_quantity: p.stock_quantity + qty })
      .eq('id', productId)
    if (stockErr) {
      return { error: `Compra registrada, pero falló actualizar el stock de un producto: ${stockErr.message}` }
    }
  }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return { }
}
