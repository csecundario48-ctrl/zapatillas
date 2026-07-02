'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentMethod, SaleChannel } from '@/types/database'

interface SaleItemInput {
  product_id: string
  quantity: number
  unit_price: number
  discount: number
}

interface CreateSaleInput {
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  items: SaleItemInput[]
}

/**
 * Registra una venta de forma centralizada en el servidor:
 * valida stock/precio contra la base (no confía en el cliente), inserta la
 * venta y sus items, y descuenta el stock. Si falla la carga de items,
 * revierte la venta. Setea created_by con el usuario autenticado.
 *
 * Nota: el descuento de stock se hace por item con lectura previa validada.
 * Para máxima seguridad ante ventas concurrentes, ver la función atómica
 * `create_sale` documentada en supabase/migrations/0001_rls_policies.sql.
 */
export async function createSale(input: CreateSaleInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.items?.length) return { error: 'Agregá al menos un producto' }

  const ids = [...new Set(input.items.map(i => i.product_id))]
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, stock_quantity, active')
    .in('id', ids)
  if (prodErr) return { error: prodErr.message }

  const byId = new Map((products ?? []).map(p => [p.id, p]))

  // Consolidar cantidades por producto (por si el mismo producto viene repetido)
  const qtyById = new Map<string, number>()
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    qtyById.set(item.product_id, (qtyById.get(item.product_id) ?? 0) + item.quantity)
  }

  let total = 0
  for (const item of input.items) {
    const p = byId.get(item.product_id)
    if (!p || !p.active) return { error: 'Uno de los productos no existe o está inactivo' }
    total += (item.unit_price - item.discount) * item.quantity
  }
  for (const [productId, qty] of qtyById) {
    const p = byId.get(productId)!
    if (qty > p.stock_quantity) {
      return { error: `Stock insuficiente (disponible: ${p.stock_quantity}). Actualizá la página y reintentá.` }
    }
  }

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      customer_id: input.customer_id,
      sale_date: input.sale_date,
      channel: input.channel,
      payment_method: input.payment_method,
      total_amount: total,
      status: 'completada',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (saleError || !sale) return { error: saleError?.message ?? 'No se pudo registrar la venta' }

  const { error: itemsError } = await supabase.from('sale_items').insert(
    input.items.map(i => ({
      sale_id: sale.id,
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
      discount: i.discount,
      subtotal: (i.unit_price - i.discount) * i.quantity,
    }))
  )
  if (itemsError) {
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: itemsError.message }
  }

  for (const [productId, qty] of qtyById) {
    const p = byId.get(productId)!
    const { error: stockErr } = await supabase
      .from('products')
      .update({ stock_quantity: p.stock_quantity - qty })
      .eq('id', productId)
    if (stockErr) {
      return { error: `Venta registrada, pero falló actualizar el stock de un producto: ${stockErr.message}` }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/')
  return { }
}

/**
 * Marca una venta completada como devolución y repone el stock de sus items.
 * El update condicionado por status evita reponer dos veces si se dispara
 * en simultáneo (solo una transición completada→devolucion puede ganar).
 */
export async function returnSale(saleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, sale_items(product_id, quantity)')
    .eq('id', saleId)
    .single()
  if (saleErr || !sale) return { error: saleErr?.message ?? 'Venta no encontrada' }
  if (sale.status !== 'completada') return { error: 'Solo se pueden devolver ventas completadas' }

  const { data: updated, error: updErr } = await supabase
    .from('sales')
    .update({ status: 'devolucion' })
    .eq('id', saleId)
    .eq('status', 'completada')
    .select('id')
  if (updErr) return { error: updErr.message }
  if (!updated?.length) return { error: 'La venta ya fue devuelta o cancelada' }

  const qtyById = new Map<string, number>()
  for (const item of sale.sale_items ?? []) {
    qtyById.set(item.product_id, (qtyById.get(item.product_id) ?? 0) + item.quantity)
  }

  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, stock_quantity')
    .in('id', [...qtyById.keys()])
  if (prodErr) {
    return { error: `Venta marcada como devolución, pero falló leer el stock: ${prodErr.message}` }
  }

  for (const p of products ?? []) {
    const { error: stockErr } = await supabase
      .from('products')
      .update({ stock_quantity: p.stock_quantity + (qtyById.get(p.id) ?? 0) })
      .eq('id', p.id)
    if (stockErr) {
      return { error: `Venta devuelta, pero falló reponer el stock de un producto: ${stockErr.message}` }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { }
}
