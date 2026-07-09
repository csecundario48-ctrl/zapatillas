import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Product } from '@/types/database'
import { StockBadgeButton } from '@/components/stock/stock-badge-button'
import { ExportCsvButton } from '@/components/common/export-csv-button'

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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock</h1>
          <p className="text-sm text-foreground/55 mt-0.5">Vista por modelo y talle</p>
        </div>
        <ExportCsvButton
          filename="stock.csv"
          headers={['SKU', 'Marca', 'Modelo', 'Color', 'Género', 'Talle', 'Stock', 'Costo', 'Precio venta']}
          rows={((products as Product[]) ?? []).map(p => [
            p.sku, p.brand, p.model, p.color, p.gender, p.size,
            p.stock_quantity, p.cost_price, p.sale_price,
          ])}
        />
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total SKUs', value: totalSKUs, color: 'text-foreground' },
          { label: 'OK', value: stockOk, color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Stock bajo', value: stockBajo, color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Sin stock', value: sinStock, color: 'text-red-600 dark:text-red-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-card border border-foreground/[0.08] rounded-xl p-4 text-center">
            <p className={`font-mono text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
            <p className="text-xs text-foreground/55 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-4 text-xs text-foreground/55">
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
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">No hay productos cargados aún.</p>
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
                className={`rounded-xl border bg-card p-5 transition-colors ${
                  hasCritical
                    ? 'border-red-500/20'
                    : hasLow
                    ? 'border-amber-500/20'
                    : 'border-foreground/[0.08]'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {group.brand} {group.model}
                    </h3>
                    <p className="text-xs text-foreground/55 mt-0.5 capitalize">
                      {group.color} · {group.gender}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-foreground/45">Stock total</p>
                    <p className={`font-mono text-lg font-semibold tabular-nums ${hasCritical ? 'text-red-600 dark:text-red-400' : hasLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
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
                        <span className="text-[10px] text-foreground/45">T{size}</span>
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
