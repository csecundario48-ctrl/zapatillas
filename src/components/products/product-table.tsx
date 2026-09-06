import Link from 'next/link'
import type { Product, Supplier, Brand, ProductCategory } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { ProductRowActions } from './product-row-actions'

interface ProductTableProps {
  products: Product[]
  isAdmin: boolean
  suppliers?: Pick<Supplier, 'id' | 'name'>[]
  categories?: ProductCategory[]
  brands?: Brand[]
  /** Si está seteado, solo se muestra/cuenta ese talle (búsqueda por talle) */
  sizeFilter?: string | null
}

const normalizeSize = (s: string) => s.trim().replace(',', '.')

/** Ordena talles: numéricos por valor, el resto alfabético; sirve para
 *  zapatillas (35–45) y para ropa (S/M/L, Única). */
function compareSizes(a: string, b: string): number {
  const na = Number(a), nb = Number(b)
  const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb)
  if (aNum && bNum) return na - nb
  if (aNum) return -1
  if (bNum) return 1
  return a.localeCompare(b)
}

function totalStock(p: Product): number {
  return (p.variants ?? []).reduce((sum, v) => sum + v.stock_quantity, 0)
}

export function ProductTable({ products, isAdmin, suppliers = [], categories = [], brands = [], sizeFilter = null }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-foreground/45 text-sm">No hay productos cargados aún.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foreground/[0.06] bg-background">
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Producto</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Categoría</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Talles</th>
            {isAdmin && (
              <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Costo</th>
            )}
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Precio</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Stock</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Estado</th>
            {isAdmin && (
              <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.map(p => {
            const visibleVariants = sizeFilter
              ? (p.variants ?? []).filter(v => normalizeSize(v.size) === sizeFilter)
              : (p.variants ?? [])
            const total = sizeFilter
              ? visibleVariants.reduce((sum, v) => sum + v.stock_quantity, 0)
              : totalStock(p)
            const sorted = [...visibleVariants].sort((a, b) => compareSizes(a.size, b.size))
            return (
              <tr key={p.id} className="border-b border-foreground/[0.06] hover:bg-foreground/[0.02] transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/catalogo/${p.id}`} className="hover:text-indigo-400 transition-colors">
                    {p.brand} {p.model}
                  </Link>
                  <span className="text-foreground/55 text-xs ml-1">· {p.color}</span>
                </td>
                <td className="px-4 py-3">
                  {p.category?.name
                    ? <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] border border-foreground/10 text-foreground/70 bg-foreground/[0.03]">{p.category.name}</span>
                    : <span className="text-foreground/30 text-xs">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {sorted.length === 0 && <span className="text-foreground/40 text-xs">—</span>}
                    {sorted.map(v => (
                      <span
                        key={v.id}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums border ${
                          v.stock_quantity === 0
                            ? 'border-foreground/10 text-foreground/35 line-through'
                            : v.stock_quantity === 1
                            ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                            : 'border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                        }`}
                        title={`Talle ${v.size}: ${v.stock_quantity}`}
                      >
                        {v.size}<span className="opacity-60">·{v.stock_quantity}</span>
                      </span>
                    ))}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground/60 tabular-nums">{formatCurrency(p.cost_price)}</td>
                )}
                <td className="px-4 py-3 font-mono font-medium text-foreground tabular-nums">{formatCurrency(p.sale_price)}</td>
                <td className="px-4 py-3">
                  <span className={total === 0 ? 'font-bold text-red-600 dark:text-red-400' : total <= 1 ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>
                    {total}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${p.active ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-muted border-foreground/10 text-foreground/55'}`}>
                    {p.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <ProductRowActions product={p} suppliers={suppliers} categories={categories} brands={brands} />
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
