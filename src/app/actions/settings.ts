'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isValidSizeRange } from '@/lib/utils/size-range'
import { normalizeCategoryName } from '@/lib/utils/category'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

/** Actualiza nombre del negocio y rango de talles (fila única id=1). */
export async function updateBusinessSettings(
  input: { business_name: string; size_min: number; size_max: number }
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const name = input.business_name.trim()
  if (!name) return { error: 'El nombre del negocio no puede estar vacío' }
  if (!isValidSizeRange(input.size_min, input.size_max)) {
    return { error: 'Rango de talles inválido: usá enteros con mínimo menor al máximo (1 a 60)' }
  }

  const { error } = await supabase
    .from('business_settings')
    .update({
      business_name: name,
      size_min: input.size_min,
      size_max: input.size_max,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/catalogo')
  revalidatePath('/')
  return {}
}

/** Guarda la URL del logo ya subido al bucket. */
export async function updateLogo(logoUrl: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('business_settings')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', 1)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/')
  return {}
}

/** Agrega una categoría de gasto (nombre único, normalizado). */
export async function addExpenseCategory(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('expense_categories').insert({ name: clean })
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una categoría con ese nombre' }
    return { error: error.message }
  }

  revalidatePath('/configuracion')
  revalidatePath('/egresos')
  return {}
}

/** Renombra una categoría existente. */
export async function renameExpenseCategory(id: string, name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('expense_categories').update({ name: clean }).eq('id', id)
  if (error) {
    if (error.code === '23505') return { error: 'Ya existe una categoría con ese nombre' }
    return { error: error.message }
  }

  revalidatePath('/configuracion')
  revalidatePath('/egresos')
  return {}
}

/** Borra una categoría. Los egresos ya cargados conservan su etiqueta. */
export async function deleteExpenseCategory(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/configuracion')
  revalidatePath('/egresos')
  return {}
}
