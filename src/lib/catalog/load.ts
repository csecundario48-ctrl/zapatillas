import { createClient } from '@/lib/supabase/server'
import type { BusinessLine, Brand, ProductCategory, CategoryAttribute } from '@/types/database'

export interface CatalogConfig {
  lines: BusinessLine[]
  /** Categorías activas, cada una con sus atributos ya anidados y ordenados. */
  categories: ProductCategory[]
  brands: Brand[]
}

/**
 * Carga la configuración del catálogo (rubros, categorías con sus atributos y
 * marcas) para alimentar el formulario dinámico y los filtros. Una sola función
 * para no repetir el mismo trío de queries en cada página.
 */
export async function loadCatalogConfig({ includeInactive = false } = {}): Promise<CatalogConfig> {
  const supabase = await createClient()
  let categoriesQuery = supabase.from('product_categories').select('*').order('sort_order')
  if (!includeInactive) categoriesQuery = categoriesQuery.eq('active', true)

  const [{ data: lines }, { data: categories }, { data: attributes }, { data: brands }] = await Promise.all([
    supabase.from('business_lines').select('*').order('sort_order'),
    categoriesQuery,
    supabase.from('category_attributes').select('*').order('sort_order'),
    supabase.from('brands').select('*').order('name'),
  ])

  const attrsByCategory = new Map<string, CategoryAttribute[]>()
  for (const a of (attributes as CategoryAttribute[] | null) ?? []) {
    const list = attrsByCategory.get(a.category_id) ?? []
    list.push(a)
    attrsByCategory.set(a.category_id, list)
  }

  const cats = ((categories as ProductCategory[] | null) ?? []).map(c => ({
    ...c,
    attributes: attrsByCategory.get(c.id) ?? [],
  }))

  return {
    lines: (lines as BusinessLine[] | null) ?? [],
    categories: cats,
    brands: (brands as Brand[] | null) ?? [],
  }
}
