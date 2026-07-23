'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus, DeliveryStatus } from '@/types/database'
import { sumByVariant, stockDelta, negativeAfterDelta } from '@/lib/utils/stock-delta'

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

export interface PurchaseRecordItem {
  variant_id: string
  product_label: string | null
  size_label: string | null
  quantity: number
  unit_cost: number
}

export interface InsertPurchaseRecordInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  payment_due_date: string | null
  notes: string | null
  created_by: string
  items: PurchaseRecordItem[]
}

/**
 * Inserta una compra y sus ítems. NO toca stock: quien la llama decide si
 * corresponde sumarlo (createPurchase lo hace si delivery_status es
 * 'recibido'; products.ts no, porque el alta/edición de variante ya deja
 * el stock en su valor final).
 */
export async function insertPurchaseRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: InsertPurchaseRecordInput
): Promise<{ purchaseId?: string; error?: string }> {
  const total = input.items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)

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
      created_by: input.created_by,
    })
    .select('id')
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'No se pudo registrar la compra' }

  const { error: iErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => ({
      purchase_id: purchase.id,
      variant_id: i.variant_id,
      product_label: i.product_label,
      size_label: i.size_label,
      quantity: i.quantity,
      unit_cost: i.unit_cost,
      subtotal: i.unit_cost * i.quantity,
    }))
  )
  if (iErr) {
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: iErr.message }
  }

  return { purchaseId: purchase.id }
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
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.variant_id)) return { error: 'Uno de los productos no existe' }
    qtyById.set(item.variant_id, (qtyById.get(item.variant_id) ?? 0) + item.quantity)
  }

  const { purchaseId, error: insertErr } = await insertPurchaseRecord(supabase, {
    supplier_id: input.supplier_id,
    purchase_date: input.purchase_date,
    payment_status: input.payment_status,
    delivery_status: input.delivery_status,
    payment_due_date: input.payment_due_date,
    notes: input.notes,
    created_by: user.id,
    items: input.items.map(i => {
      const v = byId.get(i.variant_id)!
      return {
        variant_id: i.variant_id,
        product_label: v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: v.size,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      }
    }),
  })
  if (insertErr || !purchaseId) return { error: insertErr ?? 'No se pudo registrar la compra' }

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

/** Marca una compra 'pedido' como 'recibido' y suma el stock de sus items. */
export async function receivePurchase(purchaseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .select('id, delivery_status, purchase_items(variant_id, quantity)')
    .eq('id', purchaseId)
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'Compra no encontrada' }

  const row = purchase as unknown as {
    delivery_status: string
    purchase_items: { variant_id: string | null; quantity: number }[]
  }
  if (row.delivery_status === 'recibido') return { error: 'La compra ya está recibida' }

  const deltas = sumByVariant(row.purchase_items ?? [])
  if (deltas.size > 0) {
    const ids = [...deltas.keys()]
    const { data: variants, error: vErr } = await supabase
      .from('product_variants')
      .select('id, stock_quantity')
      .in('id', ids)
    if (vErr) return { error: vErr.message }
    const stockById = new Map((variants ?? []).map(v => [v.id, v.stock_quantity]))

    for (const [variantId, qty] of deltas) {
      const current = stockById.get(variantId) ?? 0
      const { error: sErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: current + qty })
        .eq('id', variantId)
      if (sErr) return { error: `Falló actualizar el stock: ${sErr.message}` }
    }
  }

  const { error: uErr } = await supabase
    .from('purchases')
    .update({ delivery_status: 'recibido' })
    .eq('id', purchaseId)
  if (uErr) return { error: `Stock sumado, pero falló marcar recibida: ${uErr.message}` }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/**
 * Borra una compra. Si estaba 'recibido', resta de cada variante el stock que
 * había sumado; si dejaría alguna variante en negativo, bloquea con aviso.
 */
export async function deletePurchase(purchaseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .select('id, delivery_status, purchase_items(variant_id, quantity, size_label)')
    .eq('id', purchaseId)
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'Compra no encontrada' }

  const row = purchase as unknown as {
    delivery_status: string
    purchase_items: { variant_id: string | null; quantity: number; size_label: string | null }[]
  }

  if (row.delivery_status === 'recibido') {
    const deltas = sumByVariant(row.purchase_items ?? [])
    if (deltas.size > 0) {
      const ids = [...deltas.keys()]
      const { data: variants, error: vErr } = await supabase
        .from('product_variants')
        .select('id, size, stock_quantity')
        .in('id', ids)
      if (vErr) return { error: vErr.message }
      const byId = new Map((variants ?? []).map(v => [v.id, v]))

      // Chequear que ninguna quede negativa ANTES de tocar nada.
      for (const [variantId, qty] of deltas) {
        const current = byId.get(variantId)?.stock_quantity ?? 0
        if (current - qty < 0) {
          const size = byId.get(variantId)?.size ?? '?'
          return {
            error: `No se puede borrar: dejaría el talle ${size} en negativo (stock actual ${current}, se intentan restar ${qty}). Ajustá el stock antes de borrar.`,
          }
        }
      }
      // Aplicar la resta.
      for (const [variantId, qty] of deltas) {
        const current = byId.get(variantId)!.stock_quantity
        const { error: sErr } = await supabase
          .from('product_variants')
          .update({ stock_quantity: current - qty })
          .eq('id', variantId)
        if (sErr) return { error: `Falló actualizar el stock: ${sErr.message}` }
      }
    }
  }

  const { error: dErr } = await supabase.from('purchases').delete().eq('id', purchaseId)
  if (dErr) return { error: dErr.message }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

export interface UpdatePurchaseInput {
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  items: PurchaseItemInput[]
}

/**
 * Edita una compra sin cambiar su estado de entrega.
 *
 * El stock se mueve SOLO si la compra está 'recibido', el único estado con
 * unidades sumadas, y por la DIFERENCIA entre los items viejos y los nuevos.
 * Bajar una cantidad puede dejar una variante en negativo si esas unidades ya
 * se vendieron: en ese caso se rechaza la edición entera.
 *
 * Los items cuyo producto se borró del catálogo (variant_id null) se conservan
 * intactos y siguen sumando al total.
 */
export async function updatePurchase(
  purchaseId: string,
  input: UpdatePurchaseInput
): Promise<{ error?: string; movedStock?: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  if (!input.supplier_id) return { error: 'Seleccioná un proveedor' }
  if (!input.items?.length) return { error: 'Agregá al menos un producto' }

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .select('id, delivery_status, purchase_items(variant_id, quantity, unit_cost, product_label, size_label, subtotal)')
    .eq('id', purchaseId)
    .single()
  if (pErr || !purchase) return { error: pErr?.message ?? 'Compra no encontrada' }

  type OldItem = {
    variant_id: string | null
    quantity: number
    unit_cost: number
    product_label: string | null
    size_label: string | null
    subtotal: number
  }
  const row = purchase as unknown as { delivery_status: string; purchase_items: OldItem[] }
  const oldItems = row.purchase_items ?? []
  const oldByVariant = new Map(
    oldItems.filter(i => i.variant_id).map(i => [i.variant_id as string, i])
  )
  const orphanTotal = oldItems
    .filter(i => !i.variant_id)
    .reduce((sum, i) => sum + i.subtotal, 0)

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

  let itemsTotal = 0
  for (const item of input.items) {
    if (item.quantity < 1) return { error: 'Cantidad inválida' }
    if (item.unit_cost < 0) return { error: 'Costo inválido' }
    if (!byId.has(item.variant_id)) return { error: 'Uno de los productos ya no existe' }
    itemsTotal += item.unit_cost * item.quantity
  }
  const total = itemsTotal + orphanTotal

  const deltas = row.delivery_status === 'recibido'
    ? stockDelta(oldItems, input.items, 'compra')
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
        error: `No se puede guardar: dejaría el talle ${sizeById.get(s.variant_id) ?? '?'} en negativo (stock actual ${s.current}, se intentan restar ${s.needed}). Ajustá el stock antes de editar.`,
      }
    }
  }

  const { error: updErr } = await supabase
    .from('purchases')
    .update({
      supplier_id: input.supplier_id,
      purchase_date: input.purchase_date,
      total_amount: total,
      payment_status: input.payment_status,
      payment_due_date: input.payment_due_date,
      notes: input.notes,
    })
    .eq('id', purchaseId)
  if (updErr) return { error: updErr.message }

  const { error: delErr } = await supabase
    .from('purchase_items')
    .delete()
    .eq('purchase_id', purchaseId)
    .not('variant_id', 'is', null)
  if (delErr) return { error: `Datos guardados, pero falló actualizar los productos: ${delErr.message}` }

  const { error: insErr } = await supabase.from('purchase_items').insert(
    input.items.map(i => {
      const prev = oldByVariant.get(i.variant_id)
      const v = byId.get(i.variant_id)!
      return {
        purchase_id: purchaseId,
        variant_id: i.variant_id,
        // Snapshots: un item que ya estaba conserva el nombre histórico del
        // producto, que pudo renombrarse desde entonces.
        product_label: prev
          ? prev.product_label
          : v.products ? `${v.products.brand} ${v.products.model} ${v.products.color}` : null,
        size_label: prev ? prev.size_label : v.size,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity,
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
      return { error: `Compra actualizada, pero falló ajustar el stock: ${stockErr.message}` }
    }
  }

  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/finanzas')
  revalidatePath('/')
  return { movedStock: deltas.size > 0 }
}
