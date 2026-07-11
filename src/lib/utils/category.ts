/** Normaliza el nombre de una categoría: recorta y colapsa espacios internos. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}
