import { describe, it, expect } from 'vitest'
import { remainingAmount, isValidDeposit } from './deposit'

describe('remainingAmount', () => {
  it('resta la seña del total', () => {
    expect(remainingAmount(80000, 10000)).toBe(70000)
  })

  it('nunca devuelve negativo', () => {
    expect(remainingAmount(50000, 60000)).toBe(0)
  })

  it('seña 0 devuelve el total', () => {
    expect(remainingAmount(50000, 0)).toBe(50000)
  })
})

describe('isValidDeposit', () => {
  it('acepta seña entre 0 y total', () => {
    expect(isValidDeposit(80000, 10000)).toBe(true)
    expect(isValidDeposit(80000, 0)).toBe(true)
    expect(isValidDeposit(80000, 80000)).toBe(true)
  })

  it('rechaza seña negativa', () => {
    expect(isValidDeposit(80000, -1)).toBe(false)
  })

  it('rechaza seña mayor al total', () => {
    expect(isValidDeposit(80000, 90000)).toBe(false)
  })
})
