'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const adjustmentSchema = z.object({
  variantId: z.string().uuid(),
  change: z.number().int().refine(n => n !== 0, 'El cambio debe ser distinto de 0'),
  reason: z.enum(['ajuste_manual', 'rotura', 'perdida', 'devolucion_proveedor']),
  notes: z.string().max(500),
})

/**
 * Ajusta el stock de una variante (talle) y deja registro en stock_adjustments.
 * El movimiento de stock se hace acá (la base en vivo no tiene triggers).
 */
export async function adjustStock(
  variantId: string,
  change: number,
  reason: string,
  notes: string
): Promise<{ error?: string }> {
  const parsed = adjustmentSchema.safeParse({ variantId, change, reason, notes })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: variant, error: fetchError } = await supabase
    .from('product_variants')
    .select('stock_quantity')
    .eq('id', parsed.data.variantId)
    .single()

  if (fetchError || !variant) return { error: 'Talle no encontrado' }

  const newQty = variant.stock_quantity + parsed.data.change
  if (newQty < 0) return { error: `Stock insuficiente. Actual: ${variant.stock_quantity}` }

  const { error: updateError } = await supabase
    .from('product_variants')
    .update({ stock_quantity: newQty })
    .eq('id', parsed.data.variantId)

  if (updateError) return { error: updateError.message }

  const { error: insertError } = await supabase.from('stock_adjustments').insert({
    variant_id: parsed.data.variantId,
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
