'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  change: z.number().int().refine(n => n !== 0, 'El cambio debe ser distinto de 0'),
  reason: z.enum(['ajuste_manual', 'rotura', 'perdida', 'devolucion_proveedor']),
  notes: z.string().max(500),
})

/**
 * Ajusta el stock de un producto y deja registro en stock_adjustments.
 * El movimiento de stock se hace acá (la base en vivo no tiene triggers;
 * ver supabase/migrations/0001_rls_policies.sql).
 */
export async function adjustStock(
  productId: string,
  change: number,
  reason: string,
  notes: string
): Promise<{ error?: string }> {
  const parsed = adjustmentSchema.safeParse({ productId, change, reason, notes })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', parsed.data.productId)
    .single()

  if (fetchError || !product) return { error: 'Producto no encontrado' }

  const newQty = product.stock_quantity + parsed.data.change
  if (newQty < 0) return { error: `Stock insuficiente. Actual: ${product.stock_quantity}` }

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newQty })
    .eq('id', parsed.data.productId)

  if (updateError) return { error: updateError.message }

  const { error: insertError } = await supabase.from('stock_adjustments').insert({
    product_id: parsed.data.productId,
    quantity_change: parsed.data.change,
    reason: parsed.data.reason,
    notes: parsed.data.notes || null,
    created_by: user.id,
  })

  if (insertError) return { error: insertError.message }

  revalidatePath('/stock')
  revalidatePath('/catalogo')
  revalidatePath('/')
  return {}
}
