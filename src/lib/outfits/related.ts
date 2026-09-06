/**
 * Productos relacionados de un producto = los que comparten algún outfit con él.
 * Función pura: recibe todos los ítems de outfit (outfit_id + product_id) y el id
 * del producto, y devuelve los ids de sus "combina con", sin repetir y sin
 * incluirlo a él mismo. Preserva el orden de aparición.
 */
export function relatedProductIds(
  items: { outfit_id: string; product_id: string }[],
  productId: string
): string[] {
  const myOutfits = new Set(
    items.filter(i => i.product_id === productId).map(i => i.outfit_id)
  )
  if (myOutfits.size === 0) return []

  const related: string[] = []
  const seen = new Set<string>([productId])
  for (const item of items) {
    if (!myOutfits.has(item.outfit_id)) continue
    if (seen.has(item.product_id)) continue
    seen.add(item.product_id)
    related.push(item.product_id)
  }
  return related
}
