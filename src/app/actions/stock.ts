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

  if (product.stock_quantity + parsed.data.change < 0) {
    return { error: `Stock insuficiente. Actual: ${product.stock_quantity}` }
  }

  // El trigger handle_stock_adjustment_insert aplica el cambio sobre products;
  // no actualizar products acá o el ajuste se aplicaría dos veces.
  const { error: insertError } = await supabase.from('stock_adjustments').insert({
    product_id: parsed.data.productId,
    quantity_change: parsed.data.change,
    reason: parsed.data.reason,
    notes: parsed.data.notes || null,
    created_by: user.id,
  })

  if (insertError) {
    // 23514: check stock_quantity >= 0 — otro usuario movió el stock a la vez.
    if (insertError.code === '23514') {
      return { error: 'Stock insuficiente: el stock cambió mientras ajustabas. Volvé a intentar.' }
    }
    return { error: insertError.message }
  }

  revalidatePath('/stock')
  revalidatePath('/catalogo')
  revalidatePath('/')
  return {}
}
