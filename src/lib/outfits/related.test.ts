import { describe, it, expect } from 'vitest'
import { relatedProductIds } from './related'

const items = [
  { outfit_id: 'o1', product_id: 'puma' },
  { outfit_id: 'o1', product_id: 'cargo_beige' },
  { outfit_id: 'o1', product_id: 'remera_blanca' },
  { outfit_id: 'o2', product_id: 'puma' },
  { outfit_id: 'o2', product_id: 'cargo_negro' },
  { outfit_id: 'o3', product_id: 'nike' },
  { outfit_id: 'o3', product_id: 'jean' },
]

describe('relatedProductIds', () => {
  it('junta los productos que comparten algún outfit, sin el propio', () => {
    expect(relatedProductIds(items, 'puma').sort()).toEqual(
      ['cargo_beige', 'cargo_negro', 'remera_blanca'].sort()
    )
  })

  it('no repite un producto aunque comparta varios outfits', () => {
    const withDup = [...items, { outfit_id: 'o2', product_id: 'remera_blanca' }]
    const res = relatedProductIds(withDup, 'puma')
    expect(res.filter(id => id === 'remera_blanca')).toHaveLength(1)
  })

  it('devuelve vacío si el producto no está en ningún outfit', () => {
    expect(relatedProductIds(items, 'inexistente')).toEqual([])
  })

  it('devuelve vacío si el producto está solo en outfits sin otros productos', () => {
    const solo = [{ outfit_id: 'ox', product_id: 'unico' }]
    expect(relatedProductIds(solo, 'unico')).toEqual([])
  })

  it('no cruza productos de outfits distintos', () => {
    expect(relatedProductIds(items, 'nike')).toEqual(['jean'])
  })
})
