import { z } from 'zod'

export const expenseSchema = z.object({
  category: z.enum([
    'alquiler', 'servicios', 'marketing', 'delivery',
    'salarios', 'packaging', 'otros',
  ]),
  type: z.enum(['fijo', 'variable']),
  description: z.string().optional(),
  amount: z.number().min(0.01, 'Debe ser mayor a 0'),
  expense_date: z.string().min(1),
  payment_method: z.string().optional(),
  recurring: z.boolean(),
  notes: z.string().optional(),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>
