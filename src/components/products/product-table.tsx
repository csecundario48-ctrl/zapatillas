import type { Product, Supplier } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { ProductRowActions } from './product-row-actions'

interface ProductTableProps {
  products: Product[]
  isAdmin: boolean
  suppliers?: Pick<Supplier, 'id' | 'name'>[]
}

export function ProductTable({ products, isAdmin, suppliers = [] }: ProductTableProps) {
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
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">SKU</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Producto</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Color</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Talle</th>
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
          {products.map(p => (
            <tr key={p.id} className="border-b border-foreground/[0.06] hover:bg-foreground/[0.02] transition-colors">
              <td className="px-4 py-3 font-mono text-[10px] text-foreground/45">{p.sku}</td>
              <td className="px-4 py-3 font-medium text-foreground">
                {p.brand} {p.model}
                <span className="text-foreground/55 text-xs ml-1 capitalize">· {p.gender}</span>
              </td>
              <td className="px-4 py-3 text-foreground/70">{p.color}</td>
              <td className="px-4 py-3 text-foreground/70">{p.size}</td>
              {isAdmin && (
                <td className="px-4 py-3 font-mono text-[12px] text-foreground/60 tabular-nums">{formatCurrency(p.cost_price)}</td>
              )}
              <td className="px-4 py-3 font-mono font-medium text-foreground tabular-nums">{formatCurrency(p.sale_price)}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    p.stock_quantity === 0
                      ? 'font-bold text-red-600 dark:text-red-400'
                      : p.stock_quantity <= 2
                      ? 'font-bold text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }
                >
                  {p.stock_quantity}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                    p.active
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-muted border-foreground/10 text-foreground/55'
                  }`}
                >
                  {p.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
              {isAdmin && (
                <td className="px-4 py-3">
                  <ProductRowActions product={p} suppliers={suppliers} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
