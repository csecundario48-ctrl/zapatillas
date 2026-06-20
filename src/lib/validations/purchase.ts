import { z } from 'zod'

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid('Seleccioná un proveedor'),
  purchase_date: z.string().min(1),
  payment_status: z.enum(['pagado', 'pendiente', 'parcial']),
  payment_due_date: z.string().optional(),
  notes: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.number().min(1),
        unit_cost: z.number().min(0),
      })
    )
    .min(1, 'Agregá al menos un producto'),
})

export type PurchaseFormData = z.infer<typeof purchaseSchema>
