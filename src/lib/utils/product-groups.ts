import { SIZE_RANGE } from './sizes'

export interface VariantWithProduct {
  id: string
  product_id: string
  size: string
  stock_quantity: number
  brand: string
  model: string
  color: string
  supplier_id: string | null
  cost_price: number
}

export interface SizeCell {
  size: string
  qty: number
  variantId: string | null
}

export interface ProductGroup {
  productId: string
  brand: string
  model: string
  color: string
  supplierId: string | null
  costPrice: number
  sizes: SizeCell[]
  totalStock: number
  minStock: number
}

export function buildProductGroups(variants: VariantWithProduct[]): ProductGroup[] {
  const map = new Map<string, {
    brand: string; model: string; color: string
    supplierId: string | null; costPrice: number
    bySize: Map<string, { qty: number; variantId: string }>
  }>()

  for (const v of variants) {
    let group = map.get(v.product_id)
    if (!group) {
      group = {
        brand: v.brand, model: v.model, color: v.color,
        supplierId: v.supplier_id, costPrice: v.cost_price,
        bySize: new Map(),
      }
      map.set(v.product_id, group)
    }
    group.bySize.set(v.size, { qty: v.stock_quantity, variantId: v.id })
  }

  const result: ProductGroup[] = []
  for (const [productId, group] of map) {
    // Unión del rango fijo + talles que existan fuera de rango, ordenada numéricamente.
    const sizeSet = new Set<string>([...SIZE_RANGE, ...group.bySize.keys()])
    const orderedSizes = [...sizeSet].sort((a, b) => Number(a) - Number(b))

    const sizes: SizeCell[] = orderedSizes.map(size => {
      const cell = group.bySize.get(size)
      return { size, qty: cell?.qty ?? 0, variantId: cell?.variantId ?? null }
    })

    let totalStock = 0
    let minStock = Infinity
    for (const { qty } of group.bySize.values()) {
      totalStock += qty
      minStock = Math.min(minStock, qty)
    }

    result.push({
      productId, brand: group.brand, model: group.model, color: group.color,
      supplierId: group.supplierId, costPrice: group.costPrice,
      sizes, totalStock, minStock,
    })
  }

  return result.sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model) || a.color.localeCompare(b.color))
}
