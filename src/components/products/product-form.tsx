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
import type { Gender, Product, Supplier } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50'
const lbl = 'text-xs text-foreground/60 uppercase tracking-wider'

interface ProductFormProps {
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  product?: Product
  onSuccess?: () => void
}

export function ProductForm({ suppliers, product, onSuccess }: ProductFormProps) {
  const router = useRouter()
  const editing = !!product
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          brand: product.brand, model: product.model, color: product.color,
          gender: product.gender, size: product.size,
          cost_price: product.cost_price, sale_price: product.sale_price,
          supplier_id: product.supplier_id ?? undefined, active: product.active,
        }
      : { active: true },
  })

  const gender = watch('gender') as Gender | undefined
  const sizes = gender ? getSizesForGender(gender) : []

  async function onSubmit(data: ProductFormData) {
    setError(null)
    const sku = generateSku(data.brand, data.model, data.color, data.size)
    const payload = { ...data, sku, supplier_id: data.supplier_id || null }
    const supabase = createClient()
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', product!.id)
      : await supabase.from('products').insert(payload)
    if (error) {
      setError(
        error.code === '23505'
          ? 'Ya existe un producto con ese SKU (misma marca, modelo, color y talle)'
          : error.message
      )
      return
    }
    toast.success(editing ? 'Producto actualizado' : 'Producto agregado')
    router.refresh()
    onSuccess?.()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className={lbl}>Marca</Label>
          <select {...register('brand')} className={sel}>
            <option value="" className="bg-card">Seleccionar</option>
            {BRANDS.map(b => <option key={b} value={b} className="bg-card">{b}</option>)}
          </select>
          {errors.brand && <p className="text-xs text-red-600 dark:text-red-400">{errors.brand.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Modelo</Label>
          <Input {...register('model')} placeholder="Air Force 1" />
          {errors.model && <p className="text-xs text-red-600 dark:text-red-400">{errors.model.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Color</Label>
          <Input {...register('color')} placeholder="Blanco/Negro" />
          {errors.color && <p className="text-xs text-red-600 dark:text-red-400">{errors.color.message}</p>}
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
            <option value="" className="bg-card">Seleccionar</option>
            <option value="hombre" className="bg-card">Hombre</option>
            <option value="mujer" className="bg-card">Mujer</option>
            <option value="nino" className="bg-card">Niño</option>
            <option value="unisex" className="bg-card">Unisex</option>
          </select>
          {errors.gender && <p className="text-xs text-red-600 dark:text-red-400">{errors.gender.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Talle</Label>
          <select {...register('size')} className={sel} disabled={!gender}>
            <option value="" className="bg-card">{gender ? 'Seleccionar' : 'Elegí género primero'}</option>
            {sizes.map(s => <option key={s} value={s} className="bg-card">{s}</option>)}
          </select>
          {errors.size && <p className="text-xs text-red-600 dark:text-red-400">{errors.size.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Proveedor</Label>
          <select {...register('supplier_id')} className={sel}>
            <option value="" className="bg-card">Sin proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Costo ($)</Label>
          <Input {...register('cost_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.cost_price && <p className="text-xs text-red-600 dark:text-red-400">{errors.cost_price.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Precio de venta ($)</Label>
          <Input {...register('sale_price', { valueAsNumber: true })} type="number" step="0.01" min="0" placeholder="0" />
          {errors.sale_price && <p className="text-xs text-red-600 dark:text-red-400">{errors.sale_price.message}</p>}
        </div>
      </div>
      {editing && (
        <label className="flex items-center gap-2 text-sm text-foreground/70 cursor-pointer hover:text-foreground transition-colors">
          <input type="checkbox" {...register('active')} className="rounded" />
          Producto activo (desactivalo para ocultarlo sin borrarlo)
        </label>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Guardando...' : editing ? 'Guardar cambios' : 'Guardar producto'}
      </Button>
    </form>
  )
}
