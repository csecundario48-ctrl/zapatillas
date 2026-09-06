/** Normaliza el nombre de una categoría: recorta y colapsa espacios internos. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/**
 * Convierte un texto en un slug ASCII: minúsculas, sin acentos, y con guiones
 * bajos en lugar de espacios/símbolos. Sirve como slug de categoría/rubro y
 * como key de atributo (que además es una clave del jsonb de atributos).
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
