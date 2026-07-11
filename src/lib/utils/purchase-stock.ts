/** Suma cantidades por variante. Ignora ítems sin variant_id (producto borrado). */
export function sumByVariant(
  items: { variant_id: string | null; quantity: number }[]
): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    if (!it.variant_id) continue
    m.set(it.variant_id, (m.get(it.variant_id) ?? 0) + it.quantity)
  }
  return m
}
