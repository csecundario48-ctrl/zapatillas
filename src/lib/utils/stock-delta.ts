export type ItemQty = { variant_id: string | null; quantity: number }

/** Una variante que quedaría con stock negativo. `needed` es cuánto se intenta restar. */
export type StockShortfall = { variant_id: string; current: number; needed: number }

/** Suma cantidades por variante. Ignora ítems sin variant_id (producto borrado). */
export function sumByVariant(items: ItemQty[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const it of items) {
    if (!it.variant_id) continue
    m.set(it.variant_id, (m.get(it.variant_id) ?? 0) + it.quantity)
  }
  return m
}

/**
 * Cuánto hay que sumarle al stock de cada variante para pasar de `before` a `after`.
 *
 * `direction` es 'venta' cuando los ítems restan stock y 'compra' cuando lo suman.
 * Omite las variantes cuyo delta da 0, de modo que una edición que no toca los
 * productos (corregir la fecha, por ejemplo) devuelve un mapa vacío.
 */
export function stockDelta(
  before: ItemQty[],
  after: ItemQty[],
  direction: 'venta' | 'compra'
): Map<string, number> {
  const sign = direction === 'venta' ? -1 : 1
  const b = sumByVariant(before)
  const a = sumByVariant(after)
  const out = new Map<string, number>()
  for (const id of new Set([...b.keys(), ...a.keys()])) {
    const delta = sign * ((a.get(id) ?? 0) - (b.get(id) ?? 0))
    if (delta !== 0) out.set(id, delta)
  }
  return out
}

/** Las variantes que quedarían con stock negativo al aplicar `deltas`. */
export function negativeAfterDelta(
  deltas: Map<string, number>,
  currentStock: Map<string, number>
): StockShortfall[] {
  const out: StockShortfall[] = []
  for (const [variantId, delta] of deltas) {
    const current = currentStock.get(variantId) ?? 0
    if (current + delta < 0) {
      out.push({ variant_id: variantId, current, needed: -delta })
    }
  }
  return out
}
