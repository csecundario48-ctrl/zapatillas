import { describe, it, expect } from 'vitest'
import { buildSizeRange, isValidSizeRange } from './size-range'

describe('buildSizeRange', () => {
  it('genera el rango inclusivo como strings', () => {
    expect(buildSizeRange(35, 38)).toEqual(['35', '36', '37', '38'])
  })
  it('un solo valor cuando min === max', () => {
    expect(buildSizeRange(40, 40)).toEqual(['40'])
  })
  it('vacío si min > max', () => {
    expect(buildSizeRange(45, 35)).toEqual([])
  })
})

describe('isValidSizeRange', () => {
  it('acepta un rango sano', () => {
    expect(isValidSizeRange(35, 45)).toBe(true)
    expect(isValidSizeRange(34, 46)).toBe(true)
  })
  it('rechaza min >= max', () => {
    expect(isValidSizeRange(40, 40)).toBe(false)
    expect(isValidSizeRange(45, 35)).toBe(false)
  })
  it('rechaza no enteros o fuera de límites', () => {
    expect(isValidSizeRange(35.5, 45)).toBe(false)
    expect(isValidSizeRange(0, 45)).toBe(false)
    expect(isValidSizeRange(35, 61)).toBe(false)
  })
})
