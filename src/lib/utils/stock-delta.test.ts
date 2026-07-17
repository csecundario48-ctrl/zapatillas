import { describe, it, expect } from 'vitest'
import { sumByVariant, stockDelta, negativeAfterDelta } from './stock-delta'

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

describe('stockDelta', () => {
  it('sin cambios devuelve mapa vacío (editar solo la fecha no mueve stock)', () => {
    const items = [{ variant_id: 'a', quantity: 2 }]
    expect(stockDelta(items, items, 'venta').size).toBe(0)
    expect(stockDelta(items, items, 'compra').size).toBe(0)
  })

  it('venta: subir la cantidad resta más stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 2 }], [{ variant_id: 'a', quantity: 3 }], 'venta')
    expect(d.get('a')).toBe(-1)
  })

  it('venta: bajar la cantidad devuelve stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 3 }], [{ variant_id: 'a', quantity: 1 }], 'venta')
    expect(d.get('a')).toBe(2)
  })

  it('compra: subir la cantidad suma más stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 2 }], [{ variant_id: 'a', quantity: 5 }], 'compra')
    expect(d.get('a')).toBe(3)
  })

  it('compra: bajar la cantidad resta stock', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 5 }], [{ variant_id: 'a', quantity: 2 }], 'compra')
    expect(d.get('a')).toBe(-3)
  })

  it('venta: agregar un ítem nuevo resta su cantidad', () => {
    const d = stockDelta([], [{ variant_id: 'a', quantity: 2 }], 'venta')
    expect(d.get('a')).toBe(-2)
  })

  it('venta: quitar un ítem devuelve todas sus unidades', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 2 }], [], 'venta')
    expect(d.get('a')).toBe(2)
  })

  it('venta: reemplazar un producto por otro devuelve uno y resta el otro', () => {
    const d = stockDelta([{ variant_id: 'a', quantity: 1 }], [{ variant_id: 'b', quantity: 1 }], 'venta')
    expect(d.get('a')).toBe(1)
    expect(d.get('b')).toBe(-1)
    expect(d.size).toBe(2)
  })

  it('agrupa el mismo variante repetido antes de comparar', () => {
    const d = stockDelta(
      [{ variant_id: 'a', quantity: 1 }, { variant_id: 'a', quantity: 1 }],
      [{ variant_id: 'a', quantity: 2 }],
      'venta'
    )
    expect(d.size).toBe(0)
  })

  it('ignora los ítems huérfanos (variant_id null) de los dos lados', () => {
    const d = stockDelta(
      [{ variant_id: null, quantity: 5 }],
      [{ variant_id: null, quantity: 9 }],
      'venta'
    )
    expect(d.size).toBe(0)
  })

  it('devuelve mapa vacío con los dos lados vacíos', () => {
    expect(stockDelta([], [], 'venta').size).toBe(0)
  })
})

describe('negativeAfterDelta', () => {
  it('no reporta nada si el stock alcanza', () => {
    expect(negativeAfterDelta(new Map([['a', -2]]), new Map([['a', 5]]))).toEqual([])
  })

  it('no reporta nada cuando el stock queda justo en cero', () => {
    expect(negativeAfterDelta(new Map([['a', -5]]), new Map([['a', 5]]))).toEqual([])
  })

  it('reporta la variante que quedaría negativa con sus números', () => {
    expect(negativeAfterDelta(new Map([['a', -3]]), new Map([['a', 1]]))).toEqual([
      { variant_id: 'a', current: 1, needed: 3 },
    ])
  })

  it('un delta positivo nunca es reportado', () => {
    expect(negativeAfterDelta(new Map([['a', 4]]), new Map([['a', 0]]))).toEqual([])
  })

  it('trata una variante sin stock conocido como cero', () => {
    expect(negativeAfterDelta(new Map([['a', -1]]), new Map())).toEqual([
      { variant_id: 'a', current: 0, needed: 1 },
    ])
  })
})
