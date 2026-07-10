import { z } from 'zod'

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')

export const purchaseSchema = z.object({
  supplier_id: z.string().uuid('Seleccioná un proveedor'),
  purchase_date: dateStr,
  payment_status: z.enum(['pagado', 'pendiente', 'parcial']),
  payment_due_date: dateStr.optional().or(z.literal('')),
  notes: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        variant_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(9999),
        unit_cost: z.number().min(0).finite(),
      })
    )
    .min(1, 'Agregá al menos un producto'),
})

export type PurchaseFormData = z.infer<typeof purchaseSchema>
