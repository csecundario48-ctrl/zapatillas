'use client'

import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { productSchema, type ProductFormData } from '@/lib/validations/product'
import { cleanAttributes } from '@/lib/catalog/attributes'
import { createProduct, updateProduct } from '@/app/actions/products'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Product, Supplier, Brand, ProductCategory } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors disabled:opacity-50'
const lbl = 'font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]'

interface ProductFormProps {
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  categories: ProductCategory[]
  brands: Brand[]
  product?: Product
  onSuccess?: () => void
}

/** Talles a mostrar: los de la categoría en su orden + los que ya tenga el
 *  producto fuera de esa lista (datos viejos), al final. */
function sizesFor(category: ProductCategory | undefined, product?: Product): string[] {
  const options = category?.size_options ?? []
  const existing = product?.variants?.map(v => v.size) ?? []
  const extras = existing.filter(s => !options.includes(s))
  return [...options, ...[...new Set(extras)]]
}

export function ProductForm({ suppliers, categories, brands, product, onSuccess }: ProductFormProps) {
  const router = useRouter()
  const editing = !!product

  const stockBySize: Record<string, number> = {}
  for (const v of product?.variants ?? []) stockBySize[v.size] = v.stock_quantity

  const [error, setError] = useState<string | null>(null)
  const [attrs, setAttrs] = useState<Record<string, string>>(() => ({ ...(product?.attributes ?? {}) }))
  const [stock, setStock] = useState<Record<string, number>>(() => ({ ...stockBySize }))

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          brand: product.brand, model: product.model, color: product.color,
          gender: product.gender ?? undefined,
          cost_price: product.cost_price, sale_price: product.sale_price,
          supplier_id: product.supplier_id ?? undefined,
          category_id: product.category_id ?? categories[0]?.id ?? '',
          active: product.active,
          variants: [],
        }
      : { active: true, variants: [], category_id: categories[0]?.id ?? '' },
  })

  const categoryId = useWatch({ control, name: 'category_id' })
  const category = useMemo(() => categories.find(c => c.id === categoryId), [categories, categoryId])
  const attrDefs = category?.attributes ?? []
  const sizes = useMemo(() => sizesFor(category, product), [category, product])

  const totalStock = sizes.reduce((sum, s) => sum + (stock[s] ?? 0), 0)

  async function onSubmit(data: ProductFormData) {
    setError(null)

    const { values: attributes, error: attrErr } = cleanAttributes(attrs, attrDefs)
    if (attrErr) { setError(attrErr); return }

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
      category_id: data.category_id,
      attributes,
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
          <Label className={lbl}>Categoría</Label>
          <select {...register('category_id')} className={sel}>
            {categories.length === 0 && <option value="">Sin categorías</option>}
            {categories.map(c => <option key={c.id} value={c.id} className="bg-card">{c.name}</option>)}
          </select>
          {errors.category_id && <p className="text-xs text-red-600 dark:text-red-400">{errors.category_id.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className={lbl}>Marca</Label>
          <select {...register('brand')} className={sel}>
            <option value="" className="bg-card">Seleccionar</option>
            {brands.map(b => <option key={b.id} value={b.name} className="bg-card">{b.name}</option>)}
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
          <Label className={lbl}>Género</Label>
          <select {...register('gender')} className={sel}>
            <option value="" className="bg-card">—</option>
            <option value="hombre" className="bg-card">Hombre</option>
            <option value="mujer" className="bg-card">Mujer</option>
            <option value="nino" className="bg-card">Niño</option>
            <option value="unisex" className="bg-card">Unisex</option>
          </select>
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

      {/* Atributos propios de la categoría (dinámicos) */}
      {attrDefs.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-foreground/[0.08] bg-background/50 p-4">
          {attrDefs.map(def => (
            <div key={def.id} className="space-y-1.5">
              <Label className={lbl}>{def.label}{def.required && <span className="text-red-500"> *</span>}</Label>
              {def.type === 'select' ? (
                <select
                  className={sel}
                  value={attrs[def.key] ?? ''}
                  onChange={e => setAttrs(prev => ({ ...prev, [def.key]: e.target.value }))}
                >
                  <option value="" className="bg-card">—</option>
                  {def.options.map(o => <option key={o} value={o} className="bg-card">{o}</option>)}
                </select>
              ) : (
                <Input
                  type={def.type === 'number' ? 'number' : 'text'}
                  value={attrs[def.key] ?? ''}
                  onChange={e => setAttrs(prev => ({ ...prev, [def.key]: e.target.value }))}
                  placeholder={def.label}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabla de talles (según la categoría) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className={lbl}>Stock por talle</Label>
          <span className="text-xs text-foreground/55">Total: <span className="font-mono font-semibold text-foreground tabular-nums">{totalStock}</span></span>
        </div>
        {sizes.length === 0 ? (
          <p className="text-xs text-foreground/45">Esta categoría no tiene talles cargados. Agregalos en Configuración.</p>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {sizes.map(size => (
              <div key={size} className="space-y-1">
                <span className="block text-center text-[10px] text-foreground/45">{size}</span>
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
        )}
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
