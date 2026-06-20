import type { Gender } from '@/types/database'

const SIZES: Record<Gender, string[]> = {
  hombre: ['38', '39', '40', '41', '42', '43', '44', '45', '46'],
  mujer: ['34', '35', '36', '37', '38', '39', '40', '41'],
  nino: ['22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
  unisex: [
    '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
    '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46',
  ],
}

export function getSizesForGender(gender: Gender): string[] {
  return SIZES[gender]
}

export const BRANDS = [
  'Nike', 'Adidas', 'Puma', 'New Balance', 'Converse',
  'Vans', 'Fila', 'Reebok', 'Asics', 'Skechers',
]

export const EXPENSE_CATEGORIES = [
  'alquiler', 'servicios', 'marketing', 'delivery',
  'salarios', 'packaging', 'otros',
] as const
