import type { CategoryAttribute, ProductAttributes } from '@/types/database'

/**
 * Limpia y valida los valores de los atributos propios de un producto contra
 * las definiciones de su categoría:
 *  - conserva solo las keys definidas (descarta cualquier extra),
 *  - recorta espacios y descarta valores vacíos,
 *  - valida los `required`,
 *  - valida que un `select` traiga una de sus opciones.
 * Devuelve los valores limpios y, si algo falla, un mensaje de error.
 */
export function cleanAttributes(
  raw: Record<string, string | undefined | null>,
  defs: CategoryAttribute[]
): { values: ProductAttributes; error?: string } {
  const values: ProductAttributes = {}

  for (const def of defs) {
    const value = (raw?.[def.key] ?? '').toString().trim()

    if (!value) {
      if (def.required) return { values, error: `Completá "${def.label}"` }
      continue
    }

    if (def.type === 'select' && def.options.length > 0 && !def.options.includes(value)) {
      return { values, error: `Valor inválido para "${def.label}"` }
    }

    values[def.key] = value
  }

  return { values }
}

/**
 * True si el producto satisface todos los filtros de atributos activos.
 * Un filtro con valor vacío (no seleccionado) no restringe.
 */
export function matchesAttributeFilters(
  attributes: ProductAttributes | null | undefined,
  filters: Record<string, string>
): boolean {
  const attrs = attributes ?? {}
  return Object.entries(filters).every(([key, value]) => !value || attrs[key] === value)
}
