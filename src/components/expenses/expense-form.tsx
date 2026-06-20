'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { expenseSchema, type ExpenseFormData } from '@/lib/validations/expense'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateForInput } from '@/lib/utils/format'
import { EXPENSE_CATEGORIES } from '@/lib/utils/sizes'

export function ExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { expense_date: formatDateForInput(), recurring: false },
  })

  async function onSubmit(data: ExpenseFormData) {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('expenses').insert(data)
    if (error) { setError(error.message); return }
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Categoría</Label>
          <select {...register('category')} className="w-full border rounded px-3 py-2 text-sm bg-white">
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c} value={c} className="capitalize">{c}</option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-red-500">{errors.category.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Tipo</Label>
          <select {...register('type')} className="w-full border rounded px-3 py-2 text-sm bg-white">
            <option value="fijo">Fijo</option>
            <option value="variable">Variable</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Descripción (opcional)</Label>
          <Input {...register('description')} placeholder="Alquiler local enero" />
        </div>
        <div className="space-y-1">
          <Label>Monto ($)</Label>
          <Input {...register('amount', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.amount && <p className="text-xs text-red-500">{errors.amount.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input {...register('expense_date')} type="date" />
          {errors.expense_date && <p className="text-xs text-red-500">{errors.expense_date.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Medio de pago</Label>
          <select {...register('payment_method')} className="w-full border rounded px-3 py-2 text-sm bg-white">
            <option value="">-</option>
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" {...register('recurring')} />
        Gasto recurrente mensual
      </label>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Registrar egreso'}
      </Button>
    </form>
  )
}
