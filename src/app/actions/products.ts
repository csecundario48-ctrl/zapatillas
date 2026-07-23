'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { insertPurchaseRecord } from './purchases'
import { argDateStr } from '@/lib/utils/format'

export interface ProductInput {
  brand: string
  model: string
  color: string
  gender: string | null
  cost_price: number
  sale_price: number
  supplier_id: string | null
  active: boolean
  variants: { size: string; stock_quantity: number }[]
}

function productFields(input: ProductInput) {
  return {
    brand: input.brand,
    model: input.model,
    color: input.color,
    gender: input.gender,
    cost_price: input.cost_price,
    sale_price: input.sale_price,
    supplier_id: input.supplier_id,
    active: input.active,
  }
}

/** Crea el producto y una variante por cada talle con stock > 0. Si hay stock
 *  inicial, además registra una compra al proveedor (sin volver a sumar
 *  stock: ya quedó en su valor final al insertar la variante). */
export async function createProduct(input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const hasInitialStock = input.variants.some(v => v.stock_quantity > 0)
  if (hasInitialStock && !input.supplier_id) {
    return { error: 'Seleccioná un proveedor: vas a cargar stock inicial y se registra como compra' }
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert(productFields(input))
    .select('id')
    .single()
  if (error || !product) return { error: error?.message ?? 'No se pudo crear el producto' }

  const variants = input.variants
    .filter(v => v.stock_quantity > 0)
    .map(v => ({ product_id: product.id, size: v.size, stock_quantity: v.stock_quantity }))

  if (variants.length > 0) {
    const { data: inserted, error: vErr } = await supabase
      .from('product_variants')
      .insert(variants)
      .select('id, size, stock_quantity')
    if (vErr) {
      await supabase.from('products').delete().eq('id', product.id)
      return { error: vErr.message }
    }

    if (input.supplier_id) {
      const { error: purchErr } = await insertPurchaseRecord(supabase, {
        supplier_id: input.supplier_id,
        purchase_date: argDateStr(),
        payment_status: 'pendiente',
        delivery_status: 'recibido',
        payment_due_date: null,
        notes: null,
        created_by: user.id,
        items: (inserted ?? []).map(v => ({
          variant_id: v.id,
          product_label: `${input.brand} ${input.model} ${input.color}`,
          size_label: v.size,
          quantity: v.stock_quantity,
          unit_cost: input.cost_price,
        })),
      })
      if (purchErr) return { error: `Producto creado, pero falló registrar la compra: ${purchErr}` }
    }
  }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/**
 * Edita el producto y sincroniza sus talles: crea los que aparecen y ajusta el
 * stock de los existentes dejando registro (stock_adjustments) en vez de
 * pisarlo. Los talles que quedan en 0 NO se borran (se conservan como variante
 * con stock 0 para no perder su historial).
 */
export async function updateProduct(productId: string, input: ProductInput): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('products').update(productFields(input)).eq('id', productId)
  if (error) return { error: error.message }

  const { data: existing, error: exErr } = await supabase
    .from('product_variants')
    .select('id, size, stock_quantity')
    .eq('product_id', productId)
  if (exErr) return { error: exErr.message }

  const bySize = new Map((existing ?? []).map(v => [v.size, v]))

  for (const wanted of input.variants) {
    const current = bySize.get(wanted.size)
    if (!current) {
      if (wanted.stock_quantity > 0) {
        const { error: insErr } = await supabase
          .from('product_variants')
          .insert({ product_id: productId, size: wanted.size, stock_quantity: wanted.stock_quantity })
        if (insErr) return { error: insErr.message }
      }
      continue
    }
    const delta = wanted.stock_quantity - current.stock_quantity
    if (delta !== 0) {
      const { error: updErr } = await supabase
        .from('product_variants')
        .update({ stock_quantity: wanted.stock_quantity })
        .eq('id', current.id)
      if (updErr) return { error: updErr.message }
      const { error: adjErr } = await supabase.from('stock_adjustments').insert({
        variant_id: current.id,
        quantity_change: delta,
        reason: 'ajuste_manual',
        notes: 'Corrección desde catálogo',
        created_by: user.id,
      })
      if (adjErr) return { error: adjErr.message }
    }
    bySize.delete(wanted.size)
  }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/** Borra el producto. Sus variantes caen por cascade; el historial de ventas/
 *  compras conserva el snapshot (product_label/size_label) y queda intacto. */
export async function deleteProduct(productId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) return { error: error.message }

  revalidatePath('/catalogo')
  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}

/** Devuelve el id de la variante (talle) creándola con stock 0 si no existe. */
export async function ensureVariant(productId: string, size: string): Promise<{ id?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }
  const { data: existing } = await supabase
    .from('product_variants')
    .select('id')
    .eq('product_id', productId).eq('size', size).maybeSingle()
  if (existing) return { id: existing.id }
  const { data, error } = await supabase
    .from('product_variants')
    .insert({ product_id: productId, size, stock_quantity: 0 })
    .select('id').single()
  if (error || !data) return { error: error?.message ?? 'No se pudo crear el talle' }
  return { id: data.id }
}
