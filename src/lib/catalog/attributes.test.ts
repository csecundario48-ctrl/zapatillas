import { describe, it, expect } from 'vitest'
import { cleanAttributes, matchesAttributeFilters } from './attributes'
import type { CategoryAttribute } from '@/types/database'

function attr(partial: Partial<CategoryAttribute> & { key: string; type: CategoryAttribute['type'] }): CategoryAttribute {
  return {
    id: partial.key,
    category_id: 'c1',
    key: partial.key,
    label: partial.label ?? partial.key,
    type: partial.type,
    options: partial.options ?? [],
    required: partial.required ?? false,
    filterable: partial.filterable ?? false,
    sort_order: partial.sort_order ?? 0,
    created_at: '',
  }
}

const defs: CategoryAttribute[] = [
  attr({ key: 'tipo', type: 'select', options: ['Cargo', 'Baggy', 'Wide', 'Recto'], required: true, filterable: true }),
  attr({ key: 'material', type: 'text' }),
]

describe('cleanAttributes', () => {
  it('conserva solo las keys definidas para la categoría', () => {
    const { values } = cleanAttributes({ tipo: 'Cargo', material: 'Gabardina', basura: 'x' }, defs)
    expect(values).toEqual({ tipo: 'Cargo', material: 'Gabardina' })
  })

  it('recorta espacios y descarta valores vacíos', () => {
    const { values } = cleanAttributes({ tipo: 'Cargo', material: '   ' }, defs)
    expect(values).toEqual({ tipo: 'Cargo' })
  })

  it('exige los atributos required', () => {
    const { error } = cleanAttributes({ material: 'Gabardina' }, defs)
    expect(error).toMatch(/tipo/i)
  })

  it('rechaza un valor fuera de las opciones de un select', () => {
    const { error } = cleanAttributes({ tipo: 'Skinny' }, defs)
    expect(error).toMatch(/tipo/i)
  })

  it('acepta cuando no hay defs (categoría sin atributos)', () => {
    const { values, error } = cleanAttributes({ cualquiera: 'x' }, [])
    expect(error).toBeUndefined()
    expect(values).toEqual({})
  })
})

describe('matchesAttributeFilters', () => {
  const product = { tipo: 'Cargo', material: 'Gabardina' }

  it('matchea cuando todos los filtros activos coinciden', () => {
    expect(matchesAttributeFilters(product, { tipo: 'Cargo' })).toBe(true)
  })

  it('no matchea cuando algún filtro difiere', () => {
    expect(matchesAttributeFilters(product, { tipo: 'Baggy' })).toBe(false)
  })

  it('ignora filtros vacíos (sin seleccionar)', () => {
    expect(matchesAttributeFilters(product, { tipo: '', material: '' })).toBe(true)
  })
})
