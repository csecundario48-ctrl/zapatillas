'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { saleSchema, type SaleFormData } from '@/lib/validations/sale'

/**
 * Registra una venta completa del lado del servidor:
 * precios y total se calculan desde la base (no se confía en el cliente),
 * se setea created_by, y si los items fallan se elimina la venta
 * para no dejar ventas huérfanas que inflen los ingresos.
 */
export async function createSale(
  input: SaleFormData
): Promise<{ error?: string; total?: number }> {
  const parsed = saleSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const productIds = data.items.map(i => i.product_id)
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('id, brand, model, size, sale_price, stock_quantity, active')
    .in('id', productIds)

  if (prodErr) return { error: prodErr.message }

  const byId = new Map((products ?? []).map(p => [p.id, p]))
  for (const item of data.items) {
    const p = byId.get(item.product_id)
    if (!p || !p.active) return { error: 'Producto no encontrado o inactivo' }
    if (item.quantity > p.stock_quantity) {
      return {
        error: `Stock insuficiente: quedan ${p.stock_quantity} ud. de ${p.brand} ${p.model} T${p.size}`,
      }
    }
  }

  const rows = data.items.map(item => {
    const p = byId.get(item.product_id)!
    return {
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: p.sale_price,
      discount: 0,
      subtotal: p.sale_price * item.quantity,
    }
  })
  const total = rows.reduce((s, r) => s + r.subtotal, 0)

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      sale_date: data.sale_date,
      channel: data.channel,
      payment_method: data.payment_method,
      customer_id: data.customer_id ?? null,
      notes: data.notes || null,
      total_amount: total,
      status: 'completada',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (saleError) return { error: saleError.message }

  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(rows.map(r => ({ ...r, sale_id: sale.id })))

  if (itemsError) {
    // Sin los items la venta no vale: la borramos para no inflar ingresos.
    await supabase.from('sales').delete().eq('id', sale.id)
    if (itemsError.code === '23514') {
      return { error: 'Stock insuficiente: otro usuario vendió el mismo producto recién. Revisá el stock.' }
    }
    return { error: itemsError.message }
  }

  revalidatePath('/')
  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/catalogo')
  return { total }
}
