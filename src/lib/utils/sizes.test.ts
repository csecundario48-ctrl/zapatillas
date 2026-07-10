import { describe, it, expect } from 'vitest'
import { SIZE_RANGE, getSizeRange } from './sizes'

describe('SIZE_RANGE', () => {
  it('va de 35 a 45 inclusive, solo enteros', () => {
    expect(SIZE_RANGE).toEqual(['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'])
  })

  it('getSizeRange devuelve una copia nueva (no la referencia interna)', () => {
    const a = getSizeRange()
    a.push('99')
    expect(SIZE_RANGE).toHaveLength(11)
  })
})
