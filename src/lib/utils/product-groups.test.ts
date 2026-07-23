import { describe, it, expect } from 'vitest'
import { buildProductGroups, type VariantWithProduct } from './product-groups'

const v = (over: Partial<VariantWithProduct>): VariantWithProduct => ({
  id: 'v1', product_id: 'p1', size: '40', stock_quantity: 1,
  brand: 'Adidas', model: 'Campus', color: 'Total Black',
  supplier_id: null, cost_price: 0, ...over,
})

describe('buildProductGroups', () => {
  it('agrupa variantes del mismo producto y suma el stock total', () => {
    const groups = buildProductGroups([
      v({ id: 'a', size: '39', stock_quantity: 1 }),
      v({ id: 'b', size: '40', stock_quantity: 2 }),
      v({ id: 'c', size: '42', stock_quantity: 3 }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].totalStock).toBe(6)
    expect(groups[0].productId).toBe('p1')
  })

  it('rellena los talles faltantes del rango 35-45 con qty 0 y variantId null', () => {
    const groups = buildProductGroups([v({ id: 'a', size: '40', stock_quantity: 2 })])
    const cell41 = groups[0].sizes.find(s => s.size === '41')
    expect(cell41).toEqual({ size: '41', qty: 0, variantId: null })
    const cell40 = groups[0].sizes.find(s => s.size === '40')
    expect(cell40).toEqual({ size: '40', qty: 2, variantId: 'a' })
  })

  it('ordena los talles de menor a mayor', () => {
    const groups = buildProductGroups([
      v({ id: 'a', size: '42' }), v({ id: 'b', size: '39' }),
    ])
    const sizes = groups[0].sizes.map(s => s.size)
    expect(sizes).toEqual(['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'])
  })

  it('incluye talles fuera del rango si existen como variante (datos viejos)', () => {
    const groups = buildProductGroups([v({ id: 'a', size: '46', stock_quantity: 1 })])
    const cell46 = groups[0].sizes.find(s => s.size === '46')
    expect(cell46).toEqual({ size: '46', qty: 1, variantId: 'a' })
  })

  it('minStock es el mínimo entre talles con variante (ignora los rellenados)', () => {
    const groups = buildProductGroups([
      v({ id: 'a', size: '39', stock_quantity: 3 }),
      v({ id: 'b', size: '40', stock_quantity: 1 }),
    ])
    expect(groups[0].minStock).toBe(1)
  })

  it('separa productos distintos (por product_id)', () => {
    const groups = buildProductGroups([
      v({ id: 'a', product_id: 'p1' }),
      v({ id: 'b', product_id: 'p2', model: 'Forum' }),
    ])
    expect(groups).toHaveLength(2)
  })

  it('pasa supplier_id y cost_price del producto al grupo', () => {
    const groups = buildProductGroups([
      v({ id: 'a', supplier_id: 'sup-1', cost_price: 15000 }),
    ])
    expect(groups[0].supplierId).toBe('sup-1')
    expect(groups[0].costPrice).toBe(15000)
  })
})
