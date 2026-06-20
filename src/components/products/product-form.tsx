'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { productSchema, type ProductFormData } from '@/lib/validations/product'
import { generateSku } from '@/lib/utils/sku'
import { getSizesForGender, BRANDS } from '@/lib/utils/sizes'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Gender, Supplier } from '@/types/database'

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
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Marca</Label>
          <select {...register('brand')} className="w-full border rounded px-3 py-2 text-sm bg-white">
            <option value="">Seleccionar</option>
            {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {errors.brand && <p className="text-xs text-red-500">{errors.brand.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Modelo</Label>
          <Input {...register('model')} placeholder="Air Force 1" />
          {errors.model && <p className="text-xs text-red-500">{errors.model.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Color</Label>
          <Input {...register('color')} placeholder="Blanco/Negro" />
          {errors.color && <p className="text-xs text-red-500">{errors.color.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Género</Label>
          <select
            {...register('gender')}
            className="w-full border rounded px-3 py-2 text-sm bg-white"
            onChange={e => {
              setValue('gender', e.target.value as Gender)
              setValue('size', '')
            }}
          >
            <option value="">Seleccionar</option>
            <option value="hombre">Hombre</option>
            <option value="mujer">Mujer</option>
            <option value="nino">Niño</option>
            <option value="unisex">Unisex</option>
          </select>
          {errors.gender && <p className="text-xs text-red-500">{errors.gender.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Talle</Label>
          <select
            {...register('size')}
            className="w-full border rounded px-3 py-2 text-sm bg-white"
            disabled={!gender}
          >
            <option value="">Seleccionar</option>
            {sizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {errors.size && <p className="text-xs text-red-500">{errors.size.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Proveedor</Label>
          <select {...register('supplier_id')} className="w-full border rounded px-3 py-2 text-sm bg-white">
            <option value="">Sin proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Costo ($)</Label>
          <Input {...register('cost_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.cost_price && <p className="text-xs text-red-500">{errors.cost_price.message}</p>}
        </div>
        <div className="space-y-1">
          <Label>Precio de venta ($)</Label>
          <Input {...register('sale_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.sale_price && <p className="text-xs text-red-500">{errors.sale_price.message}</p>}
        </div>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Guardando...' : 'Guardar producto'}
      </Button>
    </form>
  )
}
