import { createClient } from '@/lib/supabase/server'

export default async function StockPage() {
  const supabase = await createClient()
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('stock_quantity')

  const critical = products?.filter(p => p.stock_quantity === 0) ?? []
  const low = products?.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 2) ?? []
  const ok = products?.filter(p => p.stock_quantity > 2) ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestión de Stock</h1>

      {critical.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-red-700 mb-2">🔴 Sin stock — {critical.length} SKU</h2>
          <ul className="space-y-1 columns-1 md:columns-2">
            {critical.map(p => (
              <li key={p.id} className="text-sm text-red-600">
                {p.brand} {p.model} — {p.color} T{p.size}
              </li>
            ))}
          </ul>
        </div>
      )}

      {low.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-700 mb-2">🟡 Stock bajo — {low.length} SKU</h2>
          <ul className="space-y-1 columns-1 md:columns-2">
            {low.map(p => (
              <li key={p.id} className="text-sm text-yellow-700">
                {p.brand} {p.model} — {p.color} T{p.size} ({p.stock_quantity} ud.)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Producto</th>
              <th className="text-left p-3">Color</th>
              <th className="text-left p-3">Género</th>
              <th className="text-left p-3">Talle</th>
              <th className="text-left p-3">Stock</th>
            </tr>
          </thead>
          <tbody>
            {products?.map(p => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-medium">{p.brand} {p.model}</td>
                <td className="p-3">{p.color}</td>
                <td className="p-3 capitalize">{p.gender}</td>
                <td className="p-3">{p.size}</td>
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
              </tr>
            ))}
          </tbody>
        </table>
        {!products?.length && (
          <p className="p-6 text-center text-gray-500 text-sm">No hay productos cargados aún.</p>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Total: {products?.length ?? 0} SKUs | OK: {ok.length} | Bajo: {low.length} | Sin stock: {critical.length}
      </p>
    </div>
  )
}
