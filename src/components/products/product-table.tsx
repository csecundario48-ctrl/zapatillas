import type { Product } from '@/types/database'
import { formatCurrency } from '@/lib/utils/format'
import { Badge } from '@/components/ui/badge'

interface ProductTableProps {
  products: Product[]
  isAdmin: boolean
}

export function ProductTable({ products, isAdmin }: ProductTableProps) {
  if (products.length === 0) {
    return <p className="p-6 text-center text-gray-500 text-sm">No hay productos cargados aún.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="text-left p-3">SKU</th>
            <th className="text-left p-3">Marca / Modelo</th>
            <th className="text-left p-3">Color</th>
            <th className="text-left p-3">Género</th>
            <th className="text-left p-3">Talle</th>
            {isAdmin && <th className="text-left p-3">Costo</th>}
            <th className="text-left p-3">Precio</th>
            <th className="text-left p-3">Stock</th>
            <th className="text-left p-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs text-gray-500">{p.sku}</td>
              <td className="p-3 font-medium">{p.brand} {p.model}</td>
              <td className="p-3">{p.color}</td>
              <td className="p-3 capitalize">{p.gender}</td>
              <td className="p-3">{p.size}</td>
              {isAdmin && <td className="p-3">{formatCurrency(p.cost_price)}</td>}
              <td className="p-3 font-medium">{formatCurrency(p.sale_price)}</td>
              <td className="p-3">
                <span
                  className={
                    p.stock_quantity === 0
                      ? 'text-red-600 font-bold'
                      : p.stock_quantity <= 2
                      ? 'text-yellow-600 font-bold'
                      : 'text-green-700'
                  }
                >
                  {p.stock_quantity}
                </span>
              </td>
              <td className="p-3">
                <Badge variant={p.active ? 'default' : 'secondary'}>
                  {p.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
