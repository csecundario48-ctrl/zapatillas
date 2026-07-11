import { describe, it, expect } from 'vitest'
import { sumByVariant } from './purchase-stock'

describe('sumByVariant', () => {
  it('suma cantidades del mismo variant_id', () => {
    const m = sumByVariant([
      { variant_id: 'a', quantity: 2 },
      { variant_id: 'a', quantity: 3 },
      { variant_id: 'b', quantity: 1 },
    ])
    expect(m.get('a')).toBe(5)
    expect(m.get('b')).toBe(1)
  })

  it('ignora items sin variant_id', () => {
    const m = sumByVariant([
      { variant_id: null, quantity: 9 },
      { variant_id: 'a', quantity: 2 },
    ])
    expect(m.has('a')).toBe(true)
    expect(m.get('a')).toBe(2)
    expect(m.size).toBe(1)
  })

  it('devuelve mapa vacío con lista vacía', () => {
    expect(sumByVariant([]).size).toBe(0)
  })
})
