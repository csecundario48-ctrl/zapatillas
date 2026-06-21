import type { Product } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'

interface ProductTableProps {
  products: Product[]
  isAdmin: boolean
}

export function ProductTable({ products, isAdmin }: ProductTableProps) {
  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-[#444] text-sm">No hay productos cargados aún.</p>
      </div>
    )
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/[0.06] bg-[#0a0a0a]">
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">SKU</th>
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Producto</th>
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Color</th>
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Talle</th>
            {isAdmin && (
              <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Costo</th>
            )}
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Precio</th>
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Stock</th>
            <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
              <td className="px-4 py-3 font-mono text-[10px] text-[#444]">{p.sku}</td>
              <td className="px-4 py-3 font-medium text-white">
                {p.brand} {p.model}
                <span className="text-[#555] text-xs ml-1 capitalize">· {p.gender}</span>
              </td>
              <td className="px-4 py-3 text-[#888]">{p.color}</td>
              <td className="px-4 py-3 text-[#888]">{p.size}</td>
              {isAdmin && (
                <td className="px-4 py-3 text-[#666]">{formatCurrency(p.cost_price)}</td>
              )}
              <td className="px-4 py-3 font-semibold text-white">{formatCurrency(p.sale_price)}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    p.stock_quantity === 0
                      ? 'font-bold text-red-400'
                      : p.stock_quantity <= 2
                      ? 'font-bold text-amber-400'
                      : 'text-emerald-400'
                  }
                >
                  {p.stock_quantity}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                    p.active
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                      : 'bg-[#1a1a1a] border-white/10 text-[#555]'
                  }`}
                >
                  {p.active ? 'Activo' : 'Inactivo'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
