import { z } from 'zod'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const saleItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
})

export const saleSchema = z.object({
  sale_date: dateStr,
  channel: z.enum(['fisica', 'online']),
  payment_method: z.enum(['efectivo', 'transferencia', 'tarjeta', 'mercadopago']),
  customer_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(saleItemSchema).min(1, 'Agregá al menos un producto'),
})

export type SaleFormData = z.infer<typeof saleSchema>
