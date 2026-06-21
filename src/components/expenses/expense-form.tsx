'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { expenseSchema, type ExpenseFormData } from '@/lib/validations/expense'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDateForInput } from '@/lib/utils/format'
import { EXPENSE_CATEGORIES } from '@/lib/utils/sizes'

const sel = 'w-full bg-[#0f0f0f] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors'

export function ExpenseForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
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
    toast.success('Egreso registrado')
    reset({ expense_date: formatDateForInput(), recurring: false })
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Categoría</Label>
          <select {...register('category')} className={sel}>
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c} value={c} className="capitalize bg-[#111]">{c}</option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-red-400">{errors.category.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Tipo</Label>
          <select {...register('type')} className={sel}>
            <option value="fijo" className="bg-[#111]">Fijo</option>
            <option value="variable" className="bg-[#111]">Variable</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Descripción</Label>
          <Input {...register('description')} placeholder="Alquiler local enero" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Monto ($)</Label>
          <Input {...register('amount', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.amount && <p className="text-xs text-red-400">{errors.amount.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Fecha</Label>
          <Input {...register('expense_date')} type="date" />
          {errors.expense_date && <p className="text-xs text-red-400">{errors.expense_date.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Medio de pago</Label>
          <select {...register('payment_method')} className={sel}>
            <option value="" className="bg-[#111]">—</option>
            <option value="efectivo" className="bg-[#111]">Efectivo</option>
            <option value="transferencia" className="bg-[#111]">Transferencia</option>
            <option value="tarjeta" className="bg-[#111]">Tarjeta</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#888] cursor-pointer hover:text-white transition-colors">
        <input type="checkbox" {...register('recurring')} className="rounded" />
        Gasto recurrente mensual
      </label>
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Guardando...' : 'Registrar egreso'}
      </Button>
    </form>
  )
}
