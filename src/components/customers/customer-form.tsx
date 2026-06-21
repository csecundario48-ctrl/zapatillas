'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { customerSchema, type CustomerFormData } from '@/lib/validations/customer'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const nn = (v?: string) => (v && v.trim() ? v.trim() : null)

export function CustomerForm({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CustomerFormData>({ resolver: zodResolver(customerSchema) })

  async function onSubmit(data: CustomerFormData) {
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from('customers').insert({
      name: data.name.trim(),
      phone: nn(data.phone),
      email: nn(data.email),
      instagram: nn(data.instagram),
      address: nn(data.address),
    })
    if (error) { setError(error.message); return }
    toast.success('Cliente agregado')
    reset()
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-[#969696] uppercase tracking-wider">Nombre</Label>
        <Input {...register('name')} placeholder="Juan Pérez" />
        {errors.name && <p className="text-xs text-red-400">{errors.name.message}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#969696] uppercase tracking-wider">Teléfono</Label>
          <Input {...register('phone')} placeholder="11 2345 6789" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#969696] uppercase tracking-wider">Instagram</Label>
          <Input {...register('instagram')} placeholder="@usuario" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[#969696] uppercase tracking-wider">Email</Label>
        <Input {...register('email')} placeholder="juan@email.com" />
        {errors.email && <p className="text-xs text-red-400">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-[#969696] uppercase tracking-wider">Dirección</Label>
        <Input {...register('address')} placeholder="Av. Siempre Viva 742" />
      </div>
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Guardando...' : 'Guardar cliente'}
      </Button>
    </form>
  )
}
