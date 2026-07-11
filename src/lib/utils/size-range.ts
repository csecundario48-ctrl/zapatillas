/** Rango de talles inclusivo como strings; vacío si min > max. */
export function buildSizeRange(min: number, max: number): string[] {
  if (min > max) return []
  const out: string[] = []
  for (let n = min; n <= max; n++) out.push(String(n))
  return out
}

/** Rango válido: enteros, min >= 1, min < max, max <= 60. */
export function isValidSizeRange(min: number, max: number): boolean {
  return (
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min >= 1 &&
    min < max &&
    max <= 60
  )
}
