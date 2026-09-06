import { describe, it, expect } from 'vitest'
import { slugify } from './category'

describe('slugify', () => {
  it('pasa a minúsculas y usa guion bajo', () => {
    expect(slugify('New Balance')).toBe('new_balance')
  })
  it('quita acentos', () => {
    expect(slugify('Categoría Época')).toBe('categoria_epoca')
  })
  it('colapsa símbolos y recorta guiones de los extremos', () => {
    expect(slugify('  Buzos / Camperas!! ')).toBe('buzos_camperas')
  })
  it('maneja texto ya slug', () => {
    expect(slugify('remeras')).toBe('remeras')
  })
})
