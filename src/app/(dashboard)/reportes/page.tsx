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

  const grossProfit = totalRevenue - totalCOGS

  return (
    <div className="space-y-7 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Reportes y Análisis</h1>
        <p className="text-sm text-[#555] mt-0.5">Estadísticas globales de ventas</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Total vendido</p>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Costo mercadería</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(totalCOGS)}</p>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-5">
          <p className="text-xs text-[#555] uppercase tracking-wider mb-2">Ganancia bruta</p>
          <p className="text-2xl font-bold text-cyan-400">{formatCurrency(grossProfit)}</p>
          {totalRevenue > 0 && (
            <p className="text-xs text-[#444] mt-1">
              Margen: {((grossProfit / totalRevenue) * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>

      {monthData.length > 0 ? (
        <>
          {/* Line chart */}
          <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white mb-5">Ventas por mes</h2>
            <SalesLineChart data={monthData} />
          </div>

          {/* Pie chart */}
          <div className="bg-[#111] border border-[#1f1f1f] rounded-xl p-6">
            <h2 className="text-sm font-semibold text-white mb-5">Unidades por marca</h2>
            <BrandPieChart data={brandData} />
          </div>

          {/* Brand ranking */}
          {brandData.length > 0 && (
            <div className="bg-[#111] border border-[#1f1f1f] rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#1a1a1a]">
                <h2 className="text-sm font-semibold text-white">Ranking de marcas</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                    <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">#</th>
                    <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">Marca</th>
                    <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {brandData.map((b, i) => (
                    <tr key={b.name} className="border-b border-[#1a1a1a] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 text-[#444] font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3 text-white font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-cyan-400 font-semibold">{b.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-xl border border-[#1f1f1f] bg-[#0f0f0f] py-20 text-center">
          <p className="text-[#444] text-sm">No hay datos de ventas aún.</p>
          <p className="text-[#333] text-xs mt-1">Los gráficos aparecerán cuando registres tus primeras ventas.</p>
        </div>
      )}
    </div>
  )
}
