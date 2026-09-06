/**
 * Parsea talles escritos como texto libre separado por comas ("S, M, L" o
 * "35, 36, 37") a una lista limpia y sin repetidos, preservando el orden.
 */
export function parseSizeOptions(raw: string): string[] {
  return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean))]
}

/** Une una lista de talles en el texto editable ("S, M, L"). */
export function joinSizeOptions(sizes: string[]): string {
  return sizes.join(', ')
}
