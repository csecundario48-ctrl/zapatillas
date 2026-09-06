'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function revalidateOutfits() {
  revalidatePath('/outfits')
  revalidatePath('/catalogo')
}

type Supabase = Awaited<ReturnType<typeof createClient>>

/** Inserta los productos de un outfit conservando el orden del array. */
async function insertItems(supabase: Supabase, outfitId: string, productIds: string[]): Promise<string | null> {
  const unique = [...new Set(productIds)]
  if (unique.length === 0) return null
  const { error } = await supabase.from('outfit_items').insert(
    unique.map((product_id, i) => ({ outfit_id: outfitId, product_id, sort_order: i }))
  )
  return error?.message ?? null
}

export interface CreateOutfitInput {
  name: string
  favorite: boolean
  productIds: string[]
}

export async function createOutfit(input: CreateOutfitInput): Promise<{ error?: string; id?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const name = input.name.trim()
  if (!name) return { error: 'Ponele un nombre al outfit' }
  if (input.productIds.length < 2) return { error: 'Un outfit necesita al menos 2 productos' }

  const { data: outfit, error } = await supabase
    .from('outfits')
    .insert({ name, favorite: input.favorite, created_by: user.id })
    .select('id')
    .single()
  if (error || !outfit) return { error: error?.message ?? 'No se pudo crear el outfit' }

  const itemsErr = await insertItems(supabase, outfit.id, input.productIds)
  if (itemsErr) {
    await supabase.from('outfits').delete().eq('id', outfit.id)
    return { error: itemsErr }
  }

  revalidateOutfits()
  return { id: outfit.id }
}

export async function updateOutfit(
  id: string,
  input: { name: string; notes?: string | null; favorite: boolean }
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const name = input.name.trim()
  if (!name) return { error: 'Ponele un nombre al outfit' }

  const { error } = await supabase
    .from('outfits')
    .update({ name, notes: input.notes ?? null, favorite: input.favorite })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateOutfits()
  return {}
}

/** Reemplaza el set de productos del outfit (agregar/quitar de un saque). */
export async function setOutfitProducts(id: string, productIds: string[]): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  if (productIds.length < 2) return { error: 'Un outfit necesita al menos 2 productos' }

  const { error: delErr } = await supabase.from('outfit_items').delete().eq('outfit_id', id)
  if (delErr) return { error: delErr.message }

  const itemsErr = await insertItems(supabase, id, productIds)
  if (itemsErr) return { error: itemsErr }
  revalidateOutfits()
  return {}
}

export async function toggleFavorite(id: string, value: boolean): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const { error } = await supabase.from('outfits').update({ favorite: value }).eq('id', id)
  if (error) return { error: error.message }
  revalidateOutfits()
  return {}
}

export async function deleteOutfit(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const { error } = await supabase.from('outfits').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateOutfits()
  return {}
}
