/** Resto a pagar de un encargo: total menos la seña, nunca negativo. */
export function remainingAmount(total: number, deposit: number): number {
  return Math.max(0, total - deposit)
}

/** La seña es válida si es >= 0 y no supera el total. */
export function isValidDeposit(total: number, deposit: number): boolean {
  return deposit >= 0 && deposit <= total
}
