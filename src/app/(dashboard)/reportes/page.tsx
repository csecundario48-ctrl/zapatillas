import { createClient } from '@/lib/supabase/server'
import { SalesLineChart } from '@/components/charts/sales-line-chart'
import { BrandPieChart } from '@/components/charts/brand-pie-chart'
import { formatCurrency } from '@/lib/utils/format'

const card = 'bg-card border border-foreground/[0.08] rounded-xl'

export default async function ReportesPage() {
  const supabase = await createClient()

  const [{ data: salesRaw }, { data: products }] = await Promise.all([
    supabase
      .from('sales')
      .select('sale_date, total_amount, channel, payment_method, sale_items(quantity, unit_price, product_variants(products(id, brand, model, cost_price)))')
      .eq('status', 'completada')
      .order('sale_date'),
    supabase
      .from('products')
      .select('id, brand, model, color, cost_price, variants:product_variants(stock_quantity)')
      .eq('active', true),
  ])

  const byMonth: Record<string, number> = {}
  const byBrand: Record<string, number> = {}
  const byProduct: Record<string, { name: string; units: number; revenue: number }> = {}
  const byChannel: Record<string, number> = {}
  const byPayment: Record<string, number> = {}
  const soldIds = new Set<string>()
  let totalRevenue = 0
  let totalCOGS = 0
  let unitsSold = 0
  const salesCount = salesRaw?.length ?? 0

  salesRaw?.forEach(sale => {
    byMonth[sale.sale_date.slice(0, 7)] = (byMonth[sale.sale_date.slice(0, 7)] ?? 0) + sale.total_amount
    totalRevenue += sale.total_amount
    byChannel[sale.channel] = (byChannel[sale.channel] ?? 0) + sale.total_amount
    if (sale.payment_method) byPayment[sale.payment_method] = (byPayment[sale.payment_method] ?? 0) + sale.total_amount
    type ReportItem = {
      quantity: number
      unit_price: number
      product_variants: { products: { id: string; brand: string; model: string; cost_price: number } | null } | null
    }
    ;((sale.sale_items ?? []) as unknown as ReportItem[]).forEach(item => {
      const p = item.product_variants?.products
      const brand = p?.brand ?? 'Otro'
      byBrand[brand] = (byBrand[brand] ?? 0) + item.quantity
      unitsSold += item.quantity
      totalCOGS += (p?.cost_price ?? 0) * item.quantity
      if (p?.id) soldIds.add(p.id)
      const key = `${p?.brand ?? ''} ${p?.model ?? ''}`.trim() || 'Otro'
      if (!byProduct[key]) byProduct[key] = { name: key, units: 0, revenue: 0 }
      byProduct[key].units += item.quantity
      byProduct[key].revenue += item.unit_price * item.quantity
    })
  })

  const monthData = Object.entries(byMonth).map(([month, total]) => ({ month, total }))
  const brandData = Object.entries(byBrand).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const topProducts = Object.values(byProduct).sort((a, b) => b.units - a.units).slice(0, 10)

  const grossProfit = totalRevenue - totalCOGS
  const margin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0

  type ProdWithVariants = { id: string; brand: string; model: string; color: string; cost_price: number; variants: { stock_quantity: number }[] }
  const prods = (products as ProdWithVariants[] | null) ?? []
  const totalStock = (p: ProdWithVariants) => p.variants.reduce((s, v) => s + v.stock_quantity, 0)
  const stockValue = prods.reduce((s, p) => s + p.cost_price * totalStock(p), 0)
  const rotation = stockValue > 0 ? totalCOGS / stockValue : 0

  // Dead stock: en stock pero nunca vendido
  const deadStock = prods
    .filter(p => totalStock(p) > 0 && !soldIds.has(p.id))
    .map(p => ({ ...p, units: totalStock(p), frozen: p.cost_price * totalStock(p) }))
    .sort((a, b) => b.frozen - a.frozen)
  const deadMoney = deadStock.reduce((s, p) => s + p.frozen, 0)

  const channelLabel: Record<string, string> = { fisica: 'Física', online: 'Online' }
  const payLabel: Record<string, string> = {
    efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', mercadopago: 'MercadoPago',
  }

  const kpis = [
    { label: 'Total vendido', value: formatCurrency(totalRevenue), color: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Costo mercadería', value: formatCurrency(totalCOGS), color: 'text-red-600 dark:text-red-400' },
    { label: 'Ganancia bruta', value: formatCurrency(grossProfit), color: 'text-indigo-400', sub: `Margen ${margin.toFixed(1)}%` },
    { label: 'Unidades vendidas', value: String(unitsSold), color: 'text-foreground', sub: `${salesCount} ventas` },
    { label: 'Ticket promedio', value: formatCurrency(avgTicket), color: 'text-violet-400' },
    { label: 'Rotación inventario', value: `${rotation.toFixed(1)}×`, color: 'text-amber-600 dark:text-amber-400', sub: 'Veces que rotó el stock' },
  ]

  return (
    <div className="space-y-7 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Reportes y Análisis</h1>
        <p className="text-sm text-foreground/55 mt-0.5">Estadísticas globales de ventas e inventario</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {kpis.map(k => (
          <div key={k.label} className={`${card} p-5`}>
            <p className="font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] mb-2">{k.label}</p>
            <p className={`font-mono text-[22px] font-semibold tabular-nums tracking-tight ${k.color}`}>{k.value}</p>
            {k.sub && <p className="text-xs text-foreground/45 mt-1">{k.sub}</p>}
          </div>
        ))}
      </div>

      {monthData.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-20 text-center">
          <p className="text-foreground/45 text-sm">No hay datos de ventas aún.</p>
          <p className="text-foreground/40 text-xs mt-1">Los reportes aparecerán cuando registres tus primeras ventas.</p>
        </div>
      ) : (
        <>
          {/* Line chart */}
          <div className={`${card} p-6`}>
            <h2 className="text-sm font-semibold text-foreground mb-5">Ventas por mes</h2>
            <SalesLineChart data={monthData} />
          </div>

          {/* Channel + payment breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BreakdownCard title="Ventas por canal" data={byChannel} labels={channelLabel} total={totalRevenue} />
            <BreakdownCard title="Por medio de pago" data={byPayment} labels={payLabel} total={totalRevenue} />
          </div>

          {/* Pie + top products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${card} p-6`}>
              <h2 className="text-sm font-semibold text-foreground mb-5">Unidades por marca</h2>
              <BrandPieChart data={brandData} />
            </div>
            <div className={`${card} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-foreground/[0.06]">
                <h2 className="text-sm font-semibold text-foreground">Top productos</h2>
              </div>
              {topProducts.length === 0 ? (
                <p className="py-10 text-center text-foreground/40 text-xs">Sin datos</p>
              ) : (
                <div className="divide-y divide-foreground/[0.05]">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="text-[10px] text-foreground/40 font-mono w-4 shrink-0">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-foreground/85 truncate">{p.name}</p>
                        <p className="text-[10px] text-foreground/45">{p.units} unidades</p>
                      </div>
                      <p className="text-[12px] font-semibold text-foreground shrink-0">{formatCurrency(p.revenue)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Brand ranking */}
          {brandData.length > 0 && (
            <div className={`${card} overflow-hidden`}>
              <div className="px-5 py-4 border-b border-foreground/[0.06]">
                <h2 className="text-sm font-semibold text-foreground">Ranking de marcas</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-foreground/[0.06] bg-background">
                    <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">#</th>
                    <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Marca</th>
                    <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Unidades</th>
                  </tr>
                </thead>
                <tbody>
                  {brandData.map((b, i) => (
                    <tr key={b.name} className="border-b border-foreground/[0.06] hover:bg-foreground/[0.02] transition-colors">
                      <td className="px-4 py-3 text-foreground/45 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3 text-foreground font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-right text-indigo-400 font-semibold">{b.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Dead stock — works even without sales */}
      {deadStock.length > 0 && (
        <div className={`${card} overflow-hidden`}>
          <div className="px-5 py-4 border-b border-foreground/[0.06] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Stock sin movimiento</h2>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{formatCurrency(deadMoney)} parados</span>
          </div>
          <p className="px-5 pt-3 text-[11px] text-foreground/45">Productos con stock que todavía no registraron ninguna venta.</p>
          <div className="divide-y divide-foreground/[0.05] mt-1">
            {deadStock.slice(0, 12).map(p => (
              <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] text-foreground/85 truncate">{p.brand} {p.model}</p>
                  <p className="text-[10px] text-foreground/45">{p.color} · {p.units} ud.</p>
                </div>
                <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">{formatCurrency(p.frozen)}</span>
              </div>
            ))}
            {deadStock.length > 12 && (
              <p className="px-5 py-2.5 text-[11px] text-foreground/45">+{deadStock.length - 12} productos más sin vender</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BreakdownCard({
  title, data, labels, total,
}: {
  title: string
  data: Record<string, number>
  labels: Record<string, string>
  total: number
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1])
  return (
    <div className={`${card} p-5`}>
      <h2 className="text-sm font-semibold text-foreground mb-4">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-xs text-foreground/40">Sin datos</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => {
            const pct = total > 0 ? (value / total) * 100 : 0
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-foreground/70">{labels[key] ?? key}</span>
                  <span className="text-foreground font-medium">{formatCurrency(value)} · {pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
                  <div className="h-full rounded-full bg-indigo-500/70" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
