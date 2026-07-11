'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentMethod, SaleChannel } from '@/types/database'
import { isValidDeposit } from '@/lib/utils/deposit'

interface SaleItemInput {
  variant_id: string
  quantity: number
  unit_price: number
  discount: number
}

interface CreateSaleInput {
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  is_encargo: boolean
  deposit_amount: number
  items: SaleItemInput[]
}

/**
 * Registra una venta: valida stock/existencia contra la base, inserta la venta
 * y sus items (con snapshot de nombre y talle), y descuenta el stock por variante.
 */
export async function createSale(input: CreateSaleInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.items?.length) return { error: 'Agregá al menos un producto' }
  if (!input.customer_id) return { error: 'Seleccioná un cliente' }

  const ids = [...new Set(input.items.map(i => i.variant_id))]
  const { data: variants, error: varErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity, products(active, brand, model, color, cost_price)')
    .in('id', ids)
  if (varErr) return { error: varErr.message }

  type Row = {
    id: string; size: string; stock_quantity: number
    products: { active: boolean; brand: string; model: string; color: string; cost_price: number } | null
  }
  const byId = new Map((variants as unknown as Row[] ?? []).map(v => [v.id, v]))

  const qtyById = new Map<string, number>()
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
  }

  let total = 0
  for (const item of input.items) {
    const v = byId.get(item.variant_id)
    if (!v || !v.products?.active) return { error: 'Uno de los productos no existe o está inactivo' }
    total += (item.unit_price - item.discount) * item.quantity
  }
  if (input.is_encargo) {
    if (!isValidDeposit(total, input.deposit_amount)) {
      return { error: 'La seña debe ser mayor o igual a 0 y no puede superar el total' }
    }
  } else {
    for (const [variantId, qty] of qtyById) {
      const v = byId.get(variantId)!
      if (qty > v.stock_quantity) {
        return { error: `Stock insuficiente (disponible: ${v.stock_quantity}). Actualizá la página y reintentá.` }
      }
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
      deposit_amount: input.is_encargo ? input.deposit_amount : 0,
      status: input.is_encargo ? 'encargo' : 'completada',
      created_by: user.id,
    })
    .select('id')
    .single()
  if (saleError || !sale) return { error: saleError?.message ?? 'No se pudo registrar la venta' }

  const { error: itemsError } = await supabase.from('sale_items').insert(
    input.items.map(i => {
      const v = byId.get(i.variant_id)!
      return {
        sale_id: sale.id,
        variant_id: i.variant_id,
        product_label: v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: v.size,
        quantity: i.quantity,
        unit_price: i.unit_price,
        unit_cost: v.products?.cost_price ?? 0,
        discount: i.discount,
        subtotal: (i.unit_price - i.discount) * i.quantity,
      }
    })
  )
  if (itemsError) {
    await supabase.from('sales').delete().eq('id', sale.id)
    return { error: itemsError.message }
  }

  if (!input.is_encargo) {
    for (const [variantId, qty] of qtyById) {
      const v = byId.get(variantId)!
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: v.stock_quantity - qty })
        .eq('id', variantId)
      if (stockErr) {
        return { error: `Venta registrada, pero falló actualizar el stock: ${stockErr.message}` }
      }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/encargos')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/**
 * Marca una venta completada como devolución y repone el stock de sus items.
 * El update condicionado por status evita reponer dos veces.
 */
export async function returnSale(saleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, sale_items(variant_id, quantity)')
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
  for (const item of (sale.sale_items ?? []) as { variant_id: string | null; quantity: number }[]) {
    if (!item.variant_id) continue
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
  }

  if (qtyById.size > 0) {
    const { data: variants, error: varErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', [...qtyById.keys()])
    if (varErr) {
      return { error: `Venta marcada como devolución, pero falló leer el stock: ${varErr.message}` }
    }
    for (const v of variants ?? []) {
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: v.stock_quantity + (qtyById.get(v.id) ?? 0) })
        .eq('id', v.id)
      if (stockErr) {
        return { error: `Venta devuelta, pero falló reponer el stock: ${stockErr.message}` }
      }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}
