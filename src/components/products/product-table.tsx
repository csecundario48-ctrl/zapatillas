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
        <p className="text-[#6e6e6e] text-sm">No hay productos cargados aún.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-[#0a0a0a]">
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">SKU</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Producto</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Color</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Talle</th>
            {isAdmin && (
              <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Costo</th>
            )}
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Precio</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Stock</th>
            <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Estado</th>
            {isAdmin && (
              <th className="text-right px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Acciones</th>
            )}
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3 font-mono text-[10px] tracking-[0.06em] text-[#6e737c]">{p.sku}</td>
              <td className="px-4 py-3 font-medium text-white">
                {p.brand} {p.model}
                <span className="text-[#828282] text-xs ml-1 capitalize">· {p.gender}</span>
              </td>
              <td className="px-4 py-3 text-[#a8a8a8]">{p.color}</td>
              <td className="px-4 py-3 text-[#a8a8a8]">{p.size}</td>
              {isAdmin && (
                <td className="px-4 py-3 font-mono text-[12px] text-[#8a8f98] tabular-nums">{formatCurrency(p.cost_price)}</td>
              )}
              <td className="px-4 py-3 font-mono font-medium text-white tabular-nums">{formatCurrency(p.sale_price)}</td>
              <td className="px-4 py-3">
                <span
                  className={`font-mono tabular-nums ${
                    p.stock_quantity === 0
                      ? 'font-semibold text-red-400'
                      : p.stock_quantity <= 2
                      ? 'font-semibold text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {p.stock_quantity}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                    p.active
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-[#1f2026] border-white/10 text-[#828282]'
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
