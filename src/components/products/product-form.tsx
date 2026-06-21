'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { productSchema, type ProductFormData } from '@/lib/validations/product'
import { generateSku } from '@/lib/utils/sku'
import { getSizesForGender, BRANDS } from '@/lib/utils/sizes'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Gender, Supplier } from '@/types/database'

const sel = 'w-full bg-[#131419] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50'
const lbl = 'text-xs text-[#969696] uppercase tracking-wider'

interface ProductFormProps {
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  onSuccess?: () => void
}

export function ProductForm({ suppliers, onSuccess }: ProductFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({ resolver: zodResolver(productSchema), defaultValues: { active: true } })

  const gender = watch('gender') as Gender | undefined
  const sizes = gender ? getSizesForGender(gender) : []

  async function onSubmit(data: ProductFormData) {
    setError(null)
    const sku = generateSku(data.brand, data.model, data.color, data.size)
    const supabase = createClient()
    const { error } = await supabase.from('products').insert({ ...data, sku })
    if (error) {
      setError(
        error.code === '23505'
          ? 'Ya existe un producto con ese SKU (misma marca, modelo, color y talle)'
          : error.message
      )
      return
    }
    toast.success('Producto agregado')
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className={lbl}>Marca</Label>
          <select {...register('brand')} className={sel}>
            <option value="" className="bg-[#15161c]">Seleccionar</option>
            {BRANDS.map(b => <option key={b} value={b} className="bg-[#15161c]">{b}</option>)}
          </select>
          {errors.brand && <p className="text-xs text-red-400">{errors.brand.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Modelo</Label>
          <Input {...register('model')} placeholder="Air Force 1" />
          {errors.model && <p className="text-xs text-red-400">{errors.model.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Color</Label>
          <Input {...register('color')} placeholder="Blanco/Negro" />
          {errors.color && <p className="text-xs text-red-400">{errors.color.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Género</Label>
          <select
            {...register('gender')}
            className={sel}
            onChange={e => {
              setValue('gender', e.target.value as Gender)
              setValue('size', '')
            }}
          >
            <option value="" className="bg-[#15161c]">Seleccionar</option>
            <option value="hombre" className="bg-[#15161c]">Hombre</option>
            <option value="mujer" className="bg-[#15161c]">Mujer</option>
            <option value="nino" className="bg-[#15161c]">Niño</option>
            <option value="unisex" className="bg-[#15161c]">Unisex</option>
          </select>
          {errors.gender && <p className="text-xs text-red-400">{errors.gender.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Talle</Label>
          <select {...register('size')} className={sel} disabled={!gender}>
            <option value="" className="bg-[#15161c]">{gender ? 'Seleccionar' : 'Elegí género primero'}</option>
            {sizes.map(s => <option key={s} value={s} className="bg-[#15161c]">{s}</option>)}
          </select>
          {errors.size && <p className="text-xs text-red-400">{errors.size.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Proveedor</Label>
          <select {...register('supplier_id')} className={sel}>
            <option value="" className="bg-[#15161c]">Sin proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-[#15161c]">{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Costo ($)</Label>
          <Input {...register('cost_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.cost_price && <p className="text-xs text-red-400">{errors.cost_price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Precio de venta ($)</Label>
          <Input {...register('sale_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.sale_price && <p className="text-xs text-red-400">{errors.sale_price.message}</p>}
        </div>
      </div>
      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Guardando...' : 'Guardar producto'}
      </Button>
    </form>
  )
}
