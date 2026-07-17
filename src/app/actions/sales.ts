'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentMethod, SaleChannel } from '@/types/database'
import { isValidDeposit } from '@/lib/utils/deposit'
import { stockDelta, negativeAfterDelta } from '@/lib/utils/stock-delta'

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

export interface UpdateSaleInput {
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  /** Solo se aplica si la venta está en estado 'encargo'. */
  deposit_amount: number
  items: SaleItemInput[]
}

/**
 * Edita una venta o un encargo sin cambiar su estado.
 *
 * El stock se mueve SOLO si la venta está 'completada', el único estado con
 * unidades descontadas, y se mueve por la DIFERENCIA entre los items viejos y
 * los nuevos: corregir la fecha no lo toca, pasar de 2 a 3 pares resta uno.
 *
 * Los items cuyo producto se borró del catálogo (variant_id null) se conservan
 * intactos —guardan el historial y no se pueden reeditar— y siguen sumando al
 * total.
 */
export async function updateSale(
  saleId: string,
  input: UpdateSaleInput
): Promise<{ error?: string; movedStock?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.items?.length) return { error: 'Agregá al menos un producto' }
  if (!input.customer_id) return { error: 'Seleccioná un cliente' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, deposit_amount, sale_items(variant_id, quantity, unit_cost, product_label, size_label, subtotal)')
    .eq('id', saleId)
    .single()
  if (saleErr || !sale) return { error: saleErr?.message ?? 'Venta no encontrada' }

  type OldItem = {
    variant_id: string | null
    quantity: number
    unit_cost: number
    product_label: string | null
    size_label: string | null
    subtotal: number
  }
  const oldItems = (sale.sale_items ?? []) as OldItem[]
  const oldByVariant = new Map(
    oldItems.filter(i => i.variant_id).map(i => [i.variant_id as string, i])
  )
  // Los huérfanos no se tocan pero siguen contando en el total.
  const orphanTotal = oldItems
    .filter(i => !i.variant_id)
    .reduce((sum, i) => sum + i.subtotal, 0)

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

  let itemsTotal = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    const v = byId.get(item.variant_id)
    if (!v) return { error: 'Uno de los productos ya no existe' }
    // Un producto inactivo puede seguir en la venta, pero no se puede agregar.
    if (!oldByVariant.has(item.variant_id) && !v.products?.active) {
      return { error: 'Uno de los productos está inactivo' }
    }
    itemsTotal += (item.unit_price - item.discount) * item.quantity
  }
  const total = itemsTotal + orphanTotal

  // La seña solo se edita en un encargo; en una venta completada que vino de
  // uno, se preserva.
  const deposit = sale.status === 'encargo' ? input.deposit_amount : sale.deposit_amount
  if (!isValidDeposit(total, deposit)) {
    return { error: 'La seña debe ser mayor o igual a 0 y no puede superar el total' }
  }

  const deltas = sale.status === 'completada'
    ? stockDelta(oldItems, input.items, 'venta')
    : new Map<string, number>()

  // Validar el stock ANTES de escribir nada.
  const stockById = new Map<string, number>()
  const sizeById = new Map<string, string>()
  if (deltas.size > 0) {
    const { data: current, error: curErr } = await supabase
      .from('product_variants')
      .select('id, size, stock_quantity')
      .in('id', [...deltas.keys()])
    if (curErr) return { error: curErr.message }
    for (const v of current ?? []) {
      stockById.set(v.id, v.stock_quantity)
      sizeById.set(v.id, v.size)
    }
    const short = negativeAfterDelta(deltas, stockById)
    if (short.length > 0) {
      const s = short[0]
      return {
        error: `No hay stock para editar: talle ${sizeById.get(s.variant_id) ?? '?'} tiene ${s.current} y se necesitan ${s.needed}. Registrá la compra o ajustá el stock antes de editar.`,
      }
    }
  }

  const { error: updErr } = await supabase
    .from('sales')
    .update({
      customer_id: input.customer_id,
      sale_date: input.sale_date,
      channel: input.channel,
      payment_method: input.payment_method,
      total_amount: total,
      deposit_amount: deposit,
    })
    .eq('id', saleId)
  if (updErr) return { error: updErr.message }

  // Se reemplazan solo los items editables: los huérfanos quedan como están.
  const { error: delErr } = await supabase
    .from('sale_items')
    .delete()
    .eq('sale_id', saleId)
    .not('variant_id', 'is', null)
  if (delErr) return { error: `Datos guardados, pero falló actualizar los productos: ${delErr.message}` }

  const { error: insErr } = await supabase.from('sale_items').insert(
    input.items.map(i => {
      const prev = oldByVariant.get(i.variant_id)
      const v = byId.get(i.variant_id)!
      return {
        sale_id: saleId,
        variant_id: i.variant_id,
        // Snapshots: un item que ya estaba conserva los suyos para no reescribir
        // el margen ni el nombre histórico. Uno nuevo toma los de hoy.
        product_label: prev
          ? prev.product_label
          : v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: prev ? prev.size_label : v.size,
        unit_cost: prev ? prev.unit_cost : (v.products?.cost_price ?? 0),
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        subtotal: (i.unit_price - i.discount) * i.quantity,
      }
    })
  )
  if (insErr) return { error: `Datos guardados, pero falló insertar los productos: ${insErr.message}` }

  for (const [variantId, delta] of deltas) {
    const current = stockById.get(variantId) ?? 0
    const { error: stockErr } = await supabase
      .from('product_variants')
      .update({ stock_quantity: current + delta })
      .eq('id', variantId)
    if (stockErr) {
      return { error: `Venta actualizada, pero falló ajustar el stock: ${stockErr.message}` }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/encargos')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { movedStock: deltas.size > 0 }
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

/**
 * Elimina una venta o un encargo (sus items se borran en cascada).
 *
 * El stock se repone SOLO si la venta estaba 'completada', que es el único
 * estado en el que hay unidades descontadas:
 *  - 'encargo'    → nunca se descontó (se descuenta recién al completar).
 *  - 'devolucion' → ya se repuso al registrar la devolución.
 *  - 'cancelada'  → nunca se descontó.
 * Reponer en esos casos inflaría el stock.
 */
export async function deleteSale(saleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: sale, error: saleErr } = await supabase
    .from('sales')
    .select('id, status, sale_items(variant_id, quantity)')
    .eq('id', saleId)
    .single()
  if (saleErr || !sale) return { error: saleErr?.message ?? 'Venta no encontrada' }

  const qtyById = new Map<string, number>()
  if (sale.status === 'completada') {
    for (const item of (sale.sale_items ?? []) as { variant_id: string | null; quantity: number }[]) {
      if (!item.variant_id) continue
      qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
    }
  }

  // Borrar primero: si el borrado falla no se tocó el stock, y si falla la
  // reposición el usuario puede corregir el stock a mano. Al revés, un reintento
  // después de un borrado fallido repondría dos veces.
  const { error: delErr } = await supabase.from('sales').delete().eq('id', saleId)
  if (delErr) return { error: delErr.message }

  if (qtyById.size > 0) {
    const { data: variants, error: varErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', [...qtyById.keys()])
    if (varErr) {
      return { error: `Venta eliminada, pero falló leer el stock para reponerlo: ${varErr.message}` }
    }

    for (const v of variants ?? []) {
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: v.stock_quantity + (qtyById.get(v.id) ?? 0) })
        .eq('id', v.id)
      if (stockErr) {
        return { error: `Venta eliminada, pero falló reponer el stock: ${stockErr.message}` }
      }
    }
  }

  revalidatePath('/ventas')
  revalidatePath('/encargos')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}

/**
 * Completa un encargo: descuenta el stock de sus items (bloquea si no alcanza),
 * lo pasa a 'completada' y registra la forma de pago del resto. El update
 * condicionado por status evita completar dos veces.
 */
export async function completeEncargo(
  saleId: string,
  paymentMethod: PaymentMethod
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: sale, error: sErr } = await supabase
    .from('sales')
    .select('id, status, sale_items(variant_id, quantity, size_label)')
    .eq('id', saleId)
    .single()
  if (sErr || !sale) return { error: sErr?.message ?? 'Encargo no encontrado' }
  if (sale.status !== 'encargo') return { error: 'Este encargo ya fue completado o cancelado' }

  const qtyById = new Map<string, number>()
  const sizeById = new Map<string, string | null>()
  for (const it of (sale.sale_items ?? []) as { variant_id: string | null; quantity: number; size_label: string | null }[]) {
    if (!it.variant_id) continue
    qtyById.set(it.variant_id, (qtyById.get(it.variant_id) ?? 0) + it.quantity)
    sizeById.set(it.variant_id, it.size_label)
  }

  if (qtyById.size > 0) {
    const ids = [...qtyById.keys()]
    const { data: variants, error: vErr } = await supabase
      .from('product_variants')
      .select('id, size, stock_quantity')
      .in('id', ids)
    if (vErr) return { error: vErr.message }
    const byId = new Map((variants ?? []).map(v => [v.id, v]))

    // Chequear stock suficiente ANTES de tocar nada.
    for (const [variantId, qty] of qtyById) {
      const current = byId.get(variantId)?.stock_quantity ?? 0
      if (current < qty) {
        const size = byId.get(variantId)?.size ?? sizeById.get(variantId) ?? '?'
        return {
          error: `No hay stock para completar: talle ${size} tiene ${current} y se necesitan ${qty}. Registrá la compra/recepción antes de completar.`,
        }
      }
    }
    // Descontar.
    for (const [variantId, qty] of qtyById) {
      const current = byId.get(variantId)!.stock_quantity
      const { error: stockErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: current - qty })
        .eq('id', variantId)
      if (stockErr) return { error: `Falló actualizar el stock: ${stockErr.message}` }
    }
  }

  const { data: updated, error: uErr } = await supabase
    .from('sales')
    .update({ status: 'completada', payment_method: paymentMethod })
    .eq('id', saleId)
    .eq('status', 'encargo')
    .select('id')
  if (uErr) return { error: `Stock descontado, pero falló completar el encargo: ${uErr.message}` }
  if (!updated?.length) return { error: 'Este encargo ya fue completado o cancelado' }

  revalidatePath('/encargos')
  revalidatePath('/ventas')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}

/**
 * Cancela un encargo: pasa a 'cancelada' sin tocar stock. La seña cobrada queda
 * para el negocio (Finanzas la cuenta como ingreso). Update condicionado por status.
 */
export async function cancelEncargo(saleId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: updated, error: uErr } = await supabase
    .from('sales')
    .update({ status: 'cancelada' })
    .eq('id', saleId)
    .eq('status', 'encargo')
    .select('id')
  if (uErr) return { error: uErr.message }
  if (!updated?.length) return { error: 'Este encargo ya fue completado o cancelado' }

  revalidatePath('/encargos')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return {}
}
