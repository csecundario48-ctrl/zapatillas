import { z } from 'zod'

export const supplierSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  contact_name: z.string().trim().optional().or(z.literal('')),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
  notes: z.string().trim().optional().or(z.literal('')),
})

export type SupplierFormData = z.infer<typeof supplierSchema>
