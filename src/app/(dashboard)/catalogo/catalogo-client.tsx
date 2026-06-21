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
  suppliers: Supplier[]
  isAdmin: boolean
}

export function CatalogoClient({ products, suppliers, isAdmin }: Props) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? products.filter(p =>
        `${p.brand} ${p.model} ${p.color} ${p.sku} ${p.size}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : products

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Catálogo</h1>
          <p className="text-[#828282] text-sm mt-0.5">
            {filtered.length} de {products.length} SKUs
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por marca, modelo, talle..."
            className="w-64 bg-[#131419] border border-white/10 text-white placeholder-[#444] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          {isAdmin && (
            <Dialog>
              <DialogTrigger render={<Button />}>+ Nuevo producto</DialogTrigger>
              <DialogContent className="max-w-2xl bg-[#15161c] border-white/10">
                <DialogHeader>
                  <DialogTitle className="text-white">Agregar producto</DialogTitle>
                </DialogHeader>
                <ProductForm suppliers={suppliers} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#15161c] py-16 text-center">
          <p className="text-[#6e6e6e] text-sm">
            {search ? `Sin resultados para "${search}"` : 'No hay productos cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-[#15161c] overflow-hidden">
          <ProductTable products={filtered} isAdmin={isAdmin} suppliers={suppliers} />
        </div>
      )}
    </div>
  )
}
