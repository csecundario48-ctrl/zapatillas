import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { StockBadgeButton } from '@/components/stock/stock-badge-button'
import { ExportCsvButton } from '@/components/common/export-csv-button'
import { buildProductGroups, type VariantWithProduct } from '@/lib/utils/product-groups'

export default async function StockPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('product_variants')
    .select('id, product_id, size, stock_quantity, products!inner(brand, model, color, active)')

  type Row = {
    id: string; product_id: string; size: string; stock_quantity: number
    products: { brand: string; model: string; color: string; active: boolean } | null
  }
  const rows = ((data as unknown as Row[]) ?? []).filter(r => r.products?.active)

  const variants: VariantWithProduct[] = rows.map(r => ({
    id: r.id, product_id: r.product_id, size: r.size, stock_quantity: r.stock_quantity,
    brand: r.products!.brand, model: r.products!.model, color: r.products!.color,
  }))
  const groups = buildProductGroups(variants)

  const totalVariants = rows.length
  const sinStock = rows.filter(r => r.stock_quantity === 0).length
  const stockBajo = rows.filter(r => r.stock_quantity === 1).length
  const stockOk = totalVariants - sinStock - stockBajo

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock</h1>
          <p className="text-sm text-foreground/55 mt-0.5">Vista por modelo y talle</p>
        </div>
        <ExportCsvButton
          filename="stock.csv"
          headers={['Marca', 'Modelo', 'Color', 'Talle', 'Stock']}
          rows={rows.map(r => [r.products!.brand, r.products!.model, r.products!.color, r.size, r.stock_quantity])}
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Talles cargados', value: totalVariants, color: 'text-foreground' },
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

      <div className="flex items-center gap-4 text-xs text-foreground/55">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/30" />2+ unidades</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/30" />1 unidad</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/30" />Sin stock</span>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">No hay productos cargados aún.</p>
          <Link href="/catalogo" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">Ir al catálogo →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const hasCritical = group.minStock === 0
            const hasLow = !hasCritical && group.minStock === 1
            return (
              <div key={group.productId} className={`rounded-xl border bg-card p-5 transition-colors ${hasCritical ? 'border-red-500/20' : hasLow ? 'border-amber-500/20' : 'border-foreground/[0.08]'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-foreground">{group.brand} {group.model}</h3>
                    <p className="text-xs text-foreground/55 mt-0.5">{group.color}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-foreground/45">Stock total</p>
                    <p className={`font-mono text-lg font-semibold tabular-nums ${hasCritical ? 'text-red-600 dark:text-red-400' : hasLow ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{group.totalStock}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.sizes.map(({ size, qty, variantId }) => (
                    <div key={size} className="flex flex-col items-center gap-1">
                      <StockBadgeButton
                        variantId={variantId}
                        productId={group.productId}
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
