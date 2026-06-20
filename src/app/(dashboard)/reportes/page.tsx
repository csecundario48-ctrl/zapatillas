import { createClient } from '@/lib/supabase/server'
import { SalesLineChart } from '@/components/charts/sales-line-chart'
import { BrandPieChart } from '@/components/charts/brand-pie-chart'
import { formatCurrency } from '@/lib/utils/format'

export default async function ReportesPage() {
  const supabase = await createClient()

  const { data: salesRaw } = await supabase
    .from('sales')
    .select('sale_date, total_amount, sale_items(quantity, products(brand, cost_price, sale_price))')
    .eq('status', 'completada')
    .order('sale_date')

  const byMonth: Record<string, number> = {}
  const byBrand: Record<string, number> = {}
  let totalRevenue = 0
  let totalCOGS = 0

  salesRaw?.forEach(sale => {
    const month = sale.sale_date.slice(0, 7)
    byMonth[month] = (byMonth[month] ?? 0) + sale.total_amount
    totalRevenue += sale.total_amount
    ;(sale.sale_items as any[])?.forEach((item: any) => {
      const brand = item.products?.brand ?? 'Otro'
      byBrand[brand] = (byBrand[brand] ?? 0) + item.quantity
      totalCOGS += (item.products?.cost_price ?? 0) * item.quantity
    })
  })

  const monthData = Object.entries(byMonth).map(([month, total]) => ({ month, total }))
  const brandData = Object.entries(byBrand)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Reportes y Análisis</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-5">
          <p className="text-gray-500 text-sm">Total vendido</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-white border rounded-lg p-5">
          <p className="text-gray-500 text-sm">Costo mercadería</p>
          <p className="text-2xl font-bold text-red-500">{formatCurrency(totalCOGS)}</p>
        </div>
        <div className="bg-white border rounded-lg p-5">
          <p className="text-gray-500 text-sm">Ganancia bruta</p>
          <p className="text-2xl font-bold">{formatCurrency(totalRevenue - totalCOGS)}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Ventas por mes</h2>
        <SalesLineChart data={monthData} />
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Unidades vendidas por marca</h2>
        <BrandPieChart data={brandData} />
      </div>

      {brandData.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">Ranking de marcas</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-3">Marca</th>
                <th className="text-left p-3">Unidades vendidas</th>
              </tr>
            </thead>
            <tbody>
              {brandData.map(b => (
                <tr key={b.name} className="border-b">
                  <td className="p-3 font-medium">{b.name}</td>
                  <td className="p-3">{b.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
