import { z } from 'zod'

export const customerSchema = z.object({
  name: z.string().min(1, 'Requerido'),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  instagram: z.string().trim().optional().or(z.literal('')),
  address: z.string().trim().optional().or(z.literal('')),
})

export type CustomerFormData = z.infer<typeof customerSchema>
