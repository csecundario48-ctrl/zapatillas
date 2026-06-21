'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function adjustStock(
  productId: string,
  change: number,
  reason: string,
  notes: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: product, error: fetchError } = await supabase
    .from('products')
    .select('stock_quantity')
    .eq('id', productId)
    .single()

  if (fetchError || !product) return { error: 'Producto no encontrado' }

  const newQty = product.stock_quantity + change
  if (newQty < 0) return { error: `Stock insuficiente. Actual: ${product.stock_quantity}` }

  const { error: updateError } = await supabase
    .from('products')
    .update({ stock_quantity: newQty })
    .eq('id', productId)

  if (updateError) return { error: updateError.message }

  await supabase.from('stock_adjustments').insert({
    product_id: productId,
    quantity_change: change,
    reason,
    notes: notes || null,
    created_by: user.id,
  })

  revalidatePath('/stock')
  revalidatePath('/')
  return {}
}
