import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Product } from '@/types/database'
import { StockBadgeButton } from '@/components/stock/stock-badge-button'

type ProductGroup = {
  brand: string
  model: string
  color: string
  gender: string
  sizes: { size: string; qty: number; id: string }[]
  totalStock: number
  minStock: number
}

function groupProducts(products: Product[]): ProductGroup[] {
  const map: Record<string, ProductGroup> = {}
  for (const p of products) {
    const key = `${p.brand}|${p.model}|${p.color}|${p.gender}`
    if (!map[key]) {
      map[key] = { brand: p.brand, model: p.model, color: p.color, gender: p.gender, sizes: [], totalStock: 0, minStock: Infinity }
    }
    map[key].sizes.push({ size: p.size, qty: p.stock_quantity, id: p.id })
    map[key].totalStock += p.stock_quantity
    map[key].minStock = Math.min(map[key].minStock, p.stock_quantity)
  }
  return Object.values(map).sort((a, b) => a.brand.localeCompare(b.brand) || a.model.localeCompare(b.model))
}

export default async function StockPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('brand')
    .order('model')
    .order('size')

  const groups = groupProducts((products as Product[]) ?? [])
  const totalSKUs = products?.length ?? 0
  const sinStock = products?.filter(p => p.stock_quantity === 0).length ?? 0
  const stockBajo = products?.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 2).length ?? 0
  const stockOk = totalSKUs - sinStock - stockBajo

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Stock</h1>
          <p className="text-sm text-[#828282] mt-0.5">Vista por modelo y talle</p>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total SKUs', value: totalSKUs, color: 'text-white' },
          { label: 'OK', value: stockOk, color: 'text-emerald-400' },
          { label: 'Stock bajo', value: stockBajo, color: 'text-amber-400' },
          { label: 'Sin stock', value: sinStock, color: 'text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#15161c] border border-white/[0.08] rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-[#828282] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-[#828282]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />
          3+ unidades
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />
          1-2 unidades
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />
          Sin stock
        </span>
      </div>

      {/* Product groups */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#131419] py-16 text-center">
          <p className="text-[#6e6e6e] text-sm">No hay productos cargados aún.</p>
          <Link
            href="/catalogo"
            className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline"
          >
            Ir al catálogo →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const hasCritical = group.minStock === 0
            const hasLow = !hasCritical && group.minStock <= 2
            return (
              <div
                key={`${group.brand}-${group.model}-${group.color}-${group.gender}`}
                className={`rounded-xl border bg-[#15161c] p-5 transition-colors ${
                  hasCritical
                    ? 'border-red-500/20'
                    : hasLow
                    ? 'border-amber-500/20'
                    : 'border-white/[0.08]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-white">
                      {group.brand} {group.model}
                    </h3>
                    <p className="text-xs text-[#828282] mt-0.5 capitalize">
                      {group.color} · {group.gender}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#6e6e6e]">Stock total</p>
                    <p className={`text-lg font-bold ${hasCritical ? 'text-red-400' : hasLow ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {group.totalStock}
                    </p>
                  </div>
                </div>

                {/* Size badges — click to adjust */}
                <div className="flex flex-wrap gap-2">
                  {group.sizes
                    .sort((a, b) => parseFloat(a.size) - parseFloat(b.size))
                    .map(({ size, qty, id }) => (
                      <div key={size} className="flex flex-col items-center gap-1">
                        <StockBadgeButton
                          productId={id}
                          productName={`${group.brand} ${group.model} ${group.color}`}
                          size={size}
                          qty={qty}
                        />
                        <span className="text-[10px] text-[#6e6e6e]">T{size}</span>
                      </div>
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
