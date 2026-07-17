'use client'

import { useState } from 'react'
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
import type { Product, Supplier } from '@/types/database'

interface Props {
  products: Product[]
  suppliers: Pick<Supplier, 'id' | 'name'>[]
  isAdmin: boolean
}

const normalizeSize = (s: string) => s.trim().replace(',', '.')

export function CatalogoClient({ products, suppliers, isAdmin }: Props) {
  const [search, setSearch] = useState('')

  const query = search.trim().toLowerCase()
  // "talle 38", "t 38", "38" o "38.5" → búsqueda por talle (solo con stock)
  const sizeToken = normalizeSize(query.replace(/talles?|t\.?/g, ''))
  const isSizeQuery = /^\d{1,2}(\.5)?$/.test(sizeToken)

  const filtered = query
    ? products.filter(p => {
        const textMatch = `${p.brand} ${p.model} ${p.color}`
          .toLowerCase()
          .includes(query)
        const sizeMatch =
          isSizeQuery &&
          (p.variants ?? []).some(
            v => normalizeSize(v.size) === sizeToken && v.stock_quantity > 0
          )
        return textMatch || sizeMatch
      })
    : products

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo</h1>
          <p className="text-foreground/55 text-sm mt-0.5">
            {filtered.length} de {products.length} productos
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, color o talle (ej. 38)..."
            className="w-64 bg-card border border-foreground/10 text-foreground placeholder-foreground/45 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          {isAdmin && (
            <Dialog>
              <DialogTrigger render={<Button />}>+ Nuevo producto</DialogTrigger>
              <DialogContent className="max-w-2xl bg-card border-foreground/10">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Agregar producto</DialogTitle>
                </DialogHeader>
                <ProductForm suppliers={suppliers} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">
            {search ? `Sin resultados para "${search}"` : 'No hay productos cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
          <ProductTable products={filtered} isAdmin={isAdmin} suppliers={suppliers} />
        </div>
      )}
    </div>
  )
}
