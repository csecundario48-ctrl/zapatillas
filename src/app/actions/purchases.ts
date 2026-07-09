'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { purchaseSchema, type PurchaseFormData } from '@/lib/validations/purchase'

/**
 * Registra una compra del lado del servidor: total calculado en servidor,
 * created_by seteado, y limpieza de la compra si los items fallan.
 */
export async function createPurchase(
  input: PurchaseFormData
): Promise<{ error?: string }> {
  const parsed = purchaseSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }
  const data = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const rows = data.items.map(item => ({
    product_id: item.product_id,
    quantity: item.quantity,
    unit_cost: item.unit_cost,
    subtotal: item.unit_cost * item.quantity,
  }))
  const total = rows.reduce((s, r) => s + r.subtotal, 0)

  const { data: purchase, error: pErr } = await supabase
    .from('purchases')
    .insert({
      supplier_id: data.supplier_id,
      purchase_date: data.purchase_date,
      total_amount: total,
      payment_status: data.payment_status,
      payment_due_date: data.payment_due_date || null,
      notes: data.notes || null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (pErr) return { error: pErr.message }

  const { error: iErr } = await supabase
    .from('purchase_items')
    .insert(rows.map(r => ({ ...r, purchase_id: purchase.id })))

  if (iErr) {
    await supabase.from('purchases').delete().eq('id', purchase.id)
    return { error: iErr.message }
  }

  revalidatePath('/')
  revalidatePath('/compras')
  revalidatePath('/stock')
  revalidatePath('/catalogo')
  return {}
}
