import { z } from 'zod'

export const productVariantSchema = z.object({
  size: z.string().min(1),
  stock_quantity: z.number().int('Debe ser entero').min(0, 'No puede ser negativo'),
})

export const productSchema = z.object({
  brand: z.string().min(1, 'Requerido'),
  model: z.string().min(1, 'Requerido'),
  color: z.string().min(1, 'Requerido'),
  gender: z.enum(['hombre', 'mujer', 'nino', 'unisex']).optional().nullable(),
  cost_price: z.number().min(0, 'Debe ser positivo'),
  sale_price: z.number().min(0, 'Debe ser positivo'),
  supplier_id: z.string().optional().nullable(),
  active: z.boolean(),
  variants: z.array(productVariantSchema),
})

export type ProductFormData = z.infer<typeof productSchema>
export type ProductVariantInput = z.infer<typeof productVariantSchema>
