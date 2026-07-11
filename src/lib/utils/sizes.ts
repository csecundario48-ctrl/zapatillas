// Rango de talles fijo del negocio: 35 a 45, solo enteros.
export const SIZE_RANGE: string[] = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45']

export function getSizeRange(): string[] {
  return [...SIZE_RANGE]
}

export const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse',
  'Vans', 'Fila', 'Reebok', 'Asics', 'Skechers',
]

export const EXPENSE_CATEGORIES = [
  'alquiler', 'servicios', 'marketing', 'delivery',
  'salarios', 'packaging', 'otros',
] as const
