import { describe, it, expect } from 'vitest'
import { normalizeCategoryName } from './category'

describe('normalizeCategoryName', () => {
  it('recorta espacios en los extremos', () => {
    expect(normalizeCategoryName('  publicidad  ')).toBe('publicidad')
  })
  it('colapsa espacios internos', () => {
    expect(normalizeCategoryName('gastos   varios')).toBe('gastos varios')
  })
  it('deja vacío como vacío', () => {
    expect(normalizeCategoryName('   ')).toBe('')
  })
})
