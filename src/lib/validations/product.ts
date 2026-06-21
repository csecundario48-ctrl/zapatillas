import { z } from 'zod'

export const productSchema = z.object({
  brand: z.string().min(1, 'Requerido'),
  model: z.string().min(1, 'Requerido'),
  color: z.string().min(1, 'Requerido'),
  gender: z.enum(['hombre', 'mujer', 'nino', 'unisex']),
  size: z.string().min(1, 'Requerido'),
  cost_price: z.number().min(0, 'Debe ser positivo'),
  sale_price: z.number().min(0, 'Debe ser positivo'),
  supplier_id: z.string().optional().nullable(),
  active: z.boolean(),
})

export type ProductFormData = z.infer<typeof productSchema>
