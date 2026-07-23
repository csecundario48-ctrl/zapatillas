'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { productSchema, type ProductFormData } from '@/lib/validations/product'
import { BRANDS } from '@/lib/utils/sizes'
import { buildSizeRange } from '@/lib/utils/size-range'
import { useSettings } from '@/components/settings/settings-context'
import { createProduct, updateProduct } from '@/app/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product, Supplier } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50'
const lbl = 'font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]'

interface ProductFormProps {
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  product?: Product
  onSuccess?: () => void
}

export function ProductForm({ suppliers, product, onSuccess }: ProductFormProps) {
  const router = useRouter()
  const editing = !!product
  const { sizeMin, sizeMax } = useSettings()
  const sizeRange = buildSizeRange(sizeMin, sizeMax)

  // Talles a mostrar: rango configurado + los que ya existan fuera de rango (datos viejos).
  const existingSizes = product?.variants?.map(v => v.size) ?? []
  const sizes = [...new Set([...sizeRange, ...existingSizes])].sort((a, b) => Number(a) - Number(b))
  const stockBySize: Record<string, number> = {}
  for (const v of product?.variants ?? []) stockBySize[v.size] = v.stock_quantity

  const [error, setError] = useState<string | null>(null)
  const [stock, setStock] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const s of sizes) init[s] = stockBySize[s] ?? 0
    return init
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          brand: product.brand, model: product.model, color: product.color,
          gender: product.gender ?? undefined,
          cost_price: product.cost_price, sale_price: product.sale_price,
          supplier_id: product.supplier_id ?? undefined, active: product.active,
          variants: [],
        }
      : { active: true, variants: [] },
  })

  const totalStock = Object.values(stock).reduce((a, b) => a + b, 0)

  async function onSubmit(data: ProductFormData) {
    setError(null)

    const hasPositiveDelta = sizes.some(size => (stock[size] ?? 0) > (stockBySize[size] ?? 0))
    if (hasPositiveDelta && !data.supplier_id) {
      setError('Seleccioná un proveedor: vas a sumar stock y se registra como compra')
      return
    }

    const input = {
      brand: data.brand, model: data.model, color: data.color,
      gender: data.gender ?? null,
      cost_price: data.cost_price, sale_price: data.sale_price,
      supplier_id: data.supplier_id || null,
      active: data.active,
      variants: sizes.map(size => ({ size, stock_quantity: stock[size] ?? 0 })),
    }
    const { error: err } = editing
      ? await updateProduct(product!.id, input)
      : await createProduct(input)
    if (err) { setError(err); return }
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
          <Input {...register('model')} placeholder="Campus" />
          {errors.model && <p className="text-xs text-red-600 dark:text-red-400">{errors.model.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Color</Label>
          <Input {...register('color')} placeholder="Total Black" />
          {errors.color && <p className="text-xs text-red-600 dark:text-red-400">{errors.color.message}</p>}
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

      {/* Tabla de talles */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={lbl}>Stock por talle</Label>
          <span className="text-xs text-foreground/55">Total: <span className="font-mono font-semibold text-foreground tabular-nums">{totalStock}</span></span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {sizes.map(size => (
            <div key={size} className="space-y-1">
              <span className="block text-center text-[10px] text-foreground/45">T{size}</span>
              <Input
                type="number"
                min={0}
                step={1}
                value={stock[size] ?? 0}
                onChange={e => setStock(prev => ({ ...prev, [size]: Math.max(0, Number(e.target.value)) }))}
                className="text-center px-1"
              />
            </div>
          ))}
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
