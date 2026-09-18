'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { supplierSchema, type SupplierFormData } from '@/lib/validations/supplier'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Supplier } from '@/types/database'

const nn = (v?: string) => (v && v.trim() ? v.trim() : null)

export function SupplierForm({ supplier, onSuccess }: { supplier?: Supplier; onSuccess?: () => void }) {
  const router = useRouter()
  const editing = !!supplier
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier
      ? {
          name: supplier.name, contact_name: supplier.contact_name ?? '', phone: supplier.phone ?? '',
          email: supplier.email ?? '', address: supplier.address ?? '', notes: supplier.notes ?? '',
        }
      : undefined,
  })

  async function onSubmit(data: SupplierFormData) {
    setError(null)
    const supabase = createClient()
    const payload = {
      name: data.name.trim(),
      contact_name: nn(data.contact_name),
      phone: nn(data.phone),
      email: nn(data.email),
      address: nn(data.address),
      notes: nn(data.notes),
    }
    const { error } = editing
      ? await supabase.from('suppliers').update(payload).eq('id', supplier!.id)
      : await supabase.from('suppliers').insert(payload)
    if (error) { setError(error.message); return }
    toast.success(editing ? 'Proveedor actualizado' : 'Proveedor agregado')
    if (!editing) reset()
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Nombre</Label>
          <Input {...register('name')} placeholder="Distribuidora Sur" />
          {errors.name && <p className="text-xs text-red-600 dark:text-red-400">{errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Contacto</Label>
          <Input {...register('contact_name')} placeholder="María López" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Teléfono</Label>
          <Input {...register('phone')} placeholder="11 2345 6789" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Email</Label>
          <Input {...register('email')} placeholder="ventas@proveedor.com" />
          {errors.email && <p className="text-xs text-red-600 dark:text-red-400">{errors.email.message}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Dirección</Label>
        <Input {...register('address')} placeholder="Calle 123, Ciudad" />
      </div>
      <div className="space-y-1.5">
        <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Notas</Label>
        <Input {...register('notes')} placeholder="Entrega los martes..." />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar proveedor'}
      </Button>
    </form>
  )
}
