'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { normalizeCategoryName, slugify } from '@/lib/utils/category'
import type { AttributeType } from '@/types/database'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

function revalidateCatalog() {
  revalidatePath('/configuracion')
  revalidatePath('/catalogo')
}

// ============================ Rubros / líneas ==============================

export async function addBusinessLine(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('business_lines').insert({ name: clean, slug: slugify(clean), sort_order: 0 })
  if (error) return { error: error.code === '23505' ? 'Ya existe un rubro con ese nombre' : error.message }
  revalidateCatalog()
  return {}
}

export async function renameBusinessLine(id: string, name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('business_lines').update({ name: clean }).eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog()
  return {}
}

export async function deleteBusinessLine(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const { count } = await supabase
    .from('product_categories')
    .select('id', { count: 'exact', head: true })
    .eq('line_id', id)
  if ((count ?? 0) > 0) return { error: 'No se puede borrar: tiene categorías asociadas' }

  const { error } = await supabase.from('business_lines').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog()
  return {}
}

// ============================== Categorías ================================

export interface CategoryInput {
  name: string
  line_id: string | null
  size_options: string[]
  active?: boolean
}

export async function addCategory(input: CategoryInput): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const clean = normalizeCategoryName(input.name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }
  if (input.size_options.length === 0) return { error: 'Cargá al menos un talle' }

  const { error } = await supabase.from('product_categories').insert({
    name: clean,
    slug: slugify(clean),
    line_id: input.line_id,
    size_options: input.size_options,
    sort_order: 0,
    active: true,
  })
  if (error) return { error: error.code === '23505' ? 'Ya existe una categoría con ese nombre' : error.message }
  revalidateCatalog()
  return {}
}

export async function updateCategory(id: string, input: CategoryInput): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const clean = normalizeCategoryName(input.name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }
  if (input.size_options.length === 0) return { error: 'Cargá al menos un talle' }

  const { error } = await supabase
    .from('product_categories')
    .update({
      name: clean,
      line_id: input.line_id,
      size_options: input.size_options,
      active: input.active ?? true,
    })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog()
  return {}
}

export async function deleteCategory(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }

  const { count } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', id)
  if ((count ?? 0) > 0) {
    return { error: 'No se puede borrar: tiene productos. Desactivala en su lugar.' }
  }

  const { error } = await supabase.from('product_categories').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog()
  return {}
}

// ============================== Atributos ================================

export interface AttributeInput {
  category_id: string
  label: string
  type: AttributeType
  options: string[]
  required: boolean
  filterable: boolean
}

export async function addAttribute(input: AttributeInput): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const label = normalizeCategoryName(input.label)
  if (!label) return { error: 'El nombre del atributo no puede estar vacío' }
  const key = slugify(label)
  if (!key) return { error: 'Nombre de atributo inválido' }
  if (input.type === 'select' && input.options.length === 0) {
    return { error: 'Un atributo de tipo "opciones" necesita al menos una opción' }
  }

  const { error } = await supabase.from('category_attributes').insert({
    category_id: input.category_id,
    key,
    label,
    type: input.type,
    options: input.type === 'select' ? input.options : [],
    required: input.required,
    filterable: input.filterable,
    sort_order: 0,
  })
  if (error) return { error: error.code === '23505' ? 'Ya existe un atributo con ese nombre en la categoría' : error.message }
  revalidateCatalog()
  return {}
}

export async function deleteAttribute(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const { error } = await supabase.from('category_attributes').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog()
  return {}
}

// =============================== Marcas =================================

export async function addBrand(name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('brands').insert({ name: clean })
  if (error) return { error: error.code === '23505' ? 'Ya existe una marca con ese nombre' : error.message }
  revalidateCatalog()
  return {}
}

export async function renameBrand(id: string, name: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const clean = normalizeCategoryName(name)
  if (!clean) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase.from('brands').update({ name: clean }).eq('id', id)
  if (error) return { error: error.code === '23505' ? 'Ya existe una marca con ese nombre' : error.message }
  revalidateCatalog()
  return {}
}

export async function deleteBrand(id: string): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser()
  if (!user) return { error: 'No autenticado' }
  const { error } = await supabase.from('brands').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidateCatalog()
  return {}
}
