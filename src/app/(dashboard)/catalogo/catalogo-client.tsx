'use client'

import { useMemo, useState } from 'react'
import { ProductTable } from '@/components/products/product-table'
import { ProductForm } from '@/components/products/product-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Product, Supplier, Brand, ProductCategory } from '@/types/database'

interface Props {
  products: Product[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  categories: ProductCategory[]
  brands: Brand[]
  isAdmin: boolean
}

const sel = 'bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

function compareSizes(a: string, b: string): number {
  const na = Number(a), nb = Number(b)
  const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb)
  if (aNum && bNum) return na - nb
  if (aNum) return -1
  if (bNum) return 1
  return a.localeCompare(b)
}

export function CatalogoClient({ products, suppliers, categories, brands, isAdmin }: Props) {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [brand, setBrand] = useState('')
  const [color, setColor] = useState('')
  const [size, setSize] = useState('')

  // Opciones de color y talle derivadas de los productos (y de la categoría
  // filtrada, si hay una elegida).
  const colorOptions = useMemo(
    () => [...new Set(products.map(p => p.color).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [products]
  )
  const sizeOptions = useMemo(() => {
    const cat = categories.find(c => c.id === categoryId)
    if (cat) return cat.size_options
    const all = new Set<string>()
    for (const p of products) for (const v of p.variants ?? []) all.add(v.size)
    return [...all].sort(compareSizes)
  }, [products, categories, categoryId])

  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => products.filter(p => {
    if (query && !`${p.brand} ${p.model} ${p.color}`.toLowerCase().includes(query)) return false
    if (categoryId && p.category_id !== categoryId) return false
    if (brand && p.brand !== brand) return false
    if (color && p.color !== color) return false
    if (size && !(p.variants ?? []).some(v => v.size === size && v.stock_quantity > 0)) return false
    return true
  }), [products, query, categoryId, brand, color, size])

  const hasFilters = !!(search || categoryId || brand || color || size)

  function clearFilters() {
    setSearch(''); setCategoryId(''); setBrand(''); setColor(''); setSize('')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo</h1>
          <p className="text-foreground/55 text-sm mt-0.5">
            {filtered.length} de {products.length} productos
          </p>
        </div>
        {isAdmin && (
          <Dialog>
            <DialogTrigger render={<Button />}>+ Nuevo producto</DialogTrigger>
            <DialogContent className="max-w-2xl bg-card border-foreground/10">
              <DialogHeader>
                <DialogTitle className="text-foreground">Agregar producto</DialogTitle>
              </DialogHeader>
              <ProductForm suppliers={suppliers} categories={categories} brands={brands} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filtros inteligentes */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar marca, modelo o color..."
          className={`${sel} w-56 placeholder-foreground/45`}
        />
        <select value={categoryId} onChange={e => { setCategoryId(e.target.value); setSize('') }} className={sel}>
          <option value="">Toda categoría</option>
          {categories.map(c => <option key={c.id} value={c.id} className="bg-card">{c.name}</option>)}
        </select>
        <select value={brand} onChange={e => setBrand(e.target.value)} className={sel}>
          <option value="">Toda marca</option>
          {brands.map(b => <option key={b.id} value={b.name} className="bg-card">{b.name}</option>)}
        </select>
        <select value={color} onChange={e => setColor(e.target.value)} className={sel}>
          <option value="">Todo color</option>
          {colorOptions.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
        </select>
        <select value={size} onChange={e => setSize(e.target.value)} className={sel}>
          <option value="">Todo talle</option>
          {sizeOptions.map(s => <option key={s} value={s} className="bg-card">{s}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-foreground/55 hover:text-foreground px-2 py-2 transition-colors">
            Limpiar
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">
            {hasFilters ? 'Sin resultados para los filtros elegidos' : 'No hay productos cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
          <ProductTable
            products={filtered}
            isAdmin={isAdmin}
            suppliers={suppliers}
            categories={categories}
            brands={brands}
            sizeFilter={size || null}
          />
        </div>
      )}
    </div>
  )
}
