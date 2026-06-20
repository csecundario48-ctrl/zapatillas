import { z } from 'zod'

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().min(1),
  unit_price: z.number().min(0),
  discount: z.number().min(0).default(0),
})

export const saleSchema = z.object({
  sale_date: z.string().min(1),
  channel: z.enum(['fisica', 'online']),
  payment_method: z.enum(['efectivo', 'transferencia', 'tarjeta', 'mercadopago']),
  notes: z.string().optional(),
  items: z.array(saleItemSchema).min(1, 'Agregá al menos un producto'),
})

export type SaleFormData = z.infer<typeof saleSchema>
