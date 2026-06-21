import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/kpis/kpi-card'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import { HeroOrbClient } from '@/components/3d/hero-orb-client'
import { AlertTriangle, ArrowUpRight, Plus } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  const [
    { data: monthlySales },
    { data: todaySalesRaw },
    { data: monthlyExpenses },
    { data: stockAlerts },
    { data: overduePurchases },
    { data: recentSales },
    { data: topProducts },
    { count: totalActiveProducts },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_items(quantity, products(cost_price))')
      .eq('status', 'completada')
      .gte('sale_date', monthStart),
    supabase
      .from('sales')
      .select('total_amount')
      .eq('status', 'completada')
      .eq('sale_date', todayStr),
    supabase.from('expenses').select('amount').gte('expense_date', monthStart),
    supabase
      .from('products')
      .select('id, brand, model, color, size, stock_quantity')
      .eq('active', true)
      .lte('stock_quantity', 2)
      .order('stock_quantity', { ascending: true }),
    supabase
      .from('purchases')
      .select('id, suppliers(name), total_amount, payment_due_date')
      .neq('payment_status', 'pagado')
      .lt('payment_due_date', todayStr),
    supabase
      .from('sales')
      .select('id, sale_date, total_amount, channel, payment_method, status, customers(name)')
      .order('created_at', { ascending: false })
      .limit(6),
    supabase
      .from('sale_items')
      .select('quantity, unit_price, products(brand, model)')
      .gte('created_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
      .limit(50),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
  ])

  // KPI calculations
  const totalIncome = monthlySales?.reduce((s, x) => s + x.total_amount, 0) ?? 0
  const todayIncome = todaySalesRaw?.reduce((s, x) => s + x.total_amount, 0) ?? 0
  const totalCOGS = monthlySales?.reduce(
    (s, sale) =>
      s +
      ((sale.sale_items as any[]) ?? []).reduce(
        (si: number, item: any) => si + (item.products?.cost_price ?? 0) * item.quantity,
        0
      ),
    0
  ) ?? 0
  const totalExpenses = monthlyExpenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const grossProfit = totalIncome - totalCOGS
  const netProfit = grossProfit - totalExpenses
  const margin = totalIncome > 0 ? Math.round((grossProfit / totalIncome) * 100) : 0
  const txCount = monthlySales?.length ?? 0
  const avgTicket = txCount > 0 ? totalIncome / txCount : 0

  const criticalStock = stockAlerts?.filter(p => p.stock_quantity === 0) ?? []
  const lowStock = stockAlerts?.filter(p => p.stock_quantity > 0) ?? []

  // Top products from sale_items
  const productMap: Record<string, { name: string; units: number; revenue: number }> = {}
  for (const item of topProducts ?? []) {
    const key = `${(item.products as any)?.brand} ${(item.products as any)?.model}`
    if (!productMap[key]) productMap[key] = { name: key, units: 0, revenue: 0 }
    productMap[key].units += item.quantity
    productMap[key].revenue += item.unit_price * item.quantity
  }
  const topList = Object.values(productMap).sort((a, b) => b.units - a.units).slice(0, 5)

  const channelLabel: Record<string, string> = { fisica: 'Física', online: 'Online' }
  const payLabel: Record<string, string> = {
    efectivo: 'Efectivo', transferencia: 'Transf.', tarjeta: 'Tarjeta', mercadopago: 'MP',
  }

  return (
    <div className="space-y-6 cine-stagger">
      {/* ─── Hero ─── */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-[#101116] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_50%,rgba(99,102,241,0.05)_0%,rgba(167,139,250,0.03)_40%,transparent_70%)]" />
        <div className="relative flex flex-col md:flex-row items-center gap-0">
          {/* Stats */}
          <div className="flex-1 px-7 py-7 z-10">
            <p className="text-[10px] text-[#505050] uppercase tracking-[0.18em] font-semibold mb-2">
              {monthName}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-white mb-5">
              Resumen del negocio
            </p>
            <div className="flex flex-wrap gap-5">
              <div>
                <p className="text-xl font-bold text-indigo-400 tracking-tight">{formatCurrency(totalIncome)}</p>
                <p className="text-[10px] text-[#5c5c5c] uppercase tracking-wider mt-0.5">Ventas mes</p>
              </div>
              <div className="w-px bg-[#1b1c22] self-stretch" />
              <div>
                <p className={`text-xl font-bold tracking-tight ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className="text-[10px] text-[#5c5c5c] uppercase tracking-wider mt-0.5">Ganancia neta</p>
              </div>
              <div className="w-px bg-[#1b1c22] self-stretch" />
              <div>
                <p className="text-xl font-bold text-violet-400 tracking-tight">{margin}%</p>
                <p className="text-[10px] text-[#5c5c5c] uppercase tracking-wider mt-0.5">Margen</p>
              </div>
              <div className="w-px bg-[#1b1c22] self-stretch" />
              <div>
                <p className="text-xl font-bold text-amber-400 tracking-tight">{formatCurrency(todayIncome)}</p>
                <p className="text-[10px] text-[#5c5c5c] uppercase tracking-wider mt-0.5">Ventas hoy</p>
              </div>
            </div>
          </div>
          {/* 3D orb */}
          <div className="relative w-full md:w-56 h-48 md:h-56 shrink-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.06),transparent_70%)] pulse-glow" />
            <HeroOrbClient />
          </div>
        </div>
      </div>

      {/* ─── KPI grid 8 cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="Ventas hoy" value={todayIncome} prefix="$" color="cyan"
          subtitle={`${todaySalesRaw?.length ?? 0} transacciones`} />
        <KpiCard title="Ventas del mes" value={totalIncome} prefix="$" color="cyan"
          subtitle={`${txCount} transacciones`} />
        <KpiCard title="Ganancia bruta" value={grossProfit} prefix="$" color="green"
          subtitle="Ingresos − costo" />
        <KpiCard title="Ganancia neta" value={Math.abs(netProfit)} prefix={netProfit < 0 ? '-$' : '$'}
          color={netProfit >= 0 ? 'violet' : 'red'} subtitle="Después de egresos" />
        <KpiCard title="Margen bruto" value={margin} suffix="%" color="amber"
          subtitle="Sobre ventas del mes" />
        <KpiCard title="Ticket promedio" value={avgTicket} prefix="$" color="cyan"
          subtitle="Por transacción" />
        <KpiCard title="SKUs activos" value={totalActiveProducts ?? 0} color="green"
          subtitle={`${criticalStock.length} sin stock`} />
        <KpiCard title="Stock bajo" value={(stockAlerts?.length ?? 0)} color={criticalStock.length > 0 ? 'red' : 'amber'}
          subtitle={`${criticalStock.length} sin stock · ${lowStock.length} bajo`} />
      </div>

      {/* ─── Alerts ─── */}
      {(overduePurchases?.length ?? 0) > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.04]">
          <AlertTriangle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-red-300">
              {overduePurchases!.length} pago{overduePurchases!.length > 1 ? 's' : ''} vencido{overduePurchases!.length > 1 ? 's' : ''} a proveedores
            </p>
            <p className="text-[11px] text-[#6e6e6e] mt-0.5 truncate">
              {overduePurchases!.map(p => (p.suppliers as any)?.name).filter(Boolean).join(', ')}
            </p>
          </div>
          <Link href="/compras" className="text-[11px] text-red-400 hover:text-red-300 font-medium shrink-0 flex items-center gap-1 transition-colors">
            Ver <ArrowUpRight size={11} />
          </Link>
        </div>
      )}

      {/* ─── Main content grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ventas recientes */}
        <div className="lg:col-span-2 rounded-xl border border-white/[0.06] bg-[#101116] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h2 className="text-[13px] font-semibold text-white">Ventas recientes</h2>
            <Link href="/ventas" className="text-[11px] text-[#6e6e6e] hover:text-indigo-400 flex items-center gap-1 transition-colors">
              Ver todas <ArrowUpRight size={11} />
            </Link>
          </div>
          {(recentSales?.length ?? 0) === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-[#5c5c5c]">Sin ventas registradas</p>
              <Link href="/ventas/nueva" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors">
                <Plus size={12} /> Registrar primera venta
              </Link>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-white/[0.05]">
                  <th className="text-left px-5 py-2.5 text-[10px] text-[#505050] uppercase tracking-wider font-semibold">Fecha</th>
                  <th className="text-left px-3 py-2.5 text-[10px] text-[#505050] uppercase tracking-wider font-semibold">Cliente</th>
                  <th className="text-left px-3 py-2.5 text-[10px] text-[#505050] uppercase tracking-wider font-semibold">Canal</th>
                  <th className="text-right px-5 py-2.5 text-[10px] text-[#505050] uppercase tracking-wider font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales!.map((sale) => (
                  <tr key={sale.id} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3 text-[#969696]">
                      {new Date(sale.sale_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-3 py-3 text-[#a8a8a8]">
                      {(sale.customers as any)?.name ?? <span className="text-[#606060]">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${
                        sale.channel === 'online'
                          ? 'bg-violet-500/10 text-violet-400'
                          : 'bg-indigo-500/10 text-indigo-400'
                      }`}>
                        {channelLabel[sale.channel] ?? sale.channel}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-white">
                      {formatCurrency(sale.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Stock crítico */}
          <div className="rounded-xl border border-white/[0.06] bg-[#101116] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-[13px] font-semibold text-white">Stock crítico</h2>
              <Link href="/stock" className="text-[11px] text-[#6e6e6e] hover:text-indigo-400 flex items-center gap-1 transition-colors">
                Ver <ArrowUpRight size={11} />
              </Link>
            </div>
            {(stockAlerts?.length ?? 0) === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[11px] text-[#505050]">Todo el stock en orden ✓</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {stockAlerts!.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] text-[#a8a8a8] truncate">{p.brand} {p.model}</p>
                      <p className="text-[10px] text-[#606060]">{p.color} · T{p.size}</p>
                    </div>
                    <span className={`text-[11px] font-bold ml-3 shrink-0 ${
                      p.stock_quantity === 0 ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {p.stock_quantity === 0 ? 'AGOTADO' : `${p.stock_quantity} ud.`}
                    </span>
                  </div>
                ))}
                {(stockAlerts!.length ?? 0) > 6 && (
                  <div className="px-5 py-2.5">
                    <Link href="/stock" className="text-[11px] text-[#6e6e6e] hover:text-indigo-400 transition-colors">
                      +{stockAlerts!.length - 6} más...
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top productos */}
          <div className="rounded-xl border border-white/[0.06] bg-[#101116] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <h2 className="text-[13px] font-semibold text-white">Más vendidos este mes</h2>
            </div>
            {topList.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[11px] text-[#505050]">Sin datos de ventas</p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {topList.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[10px] text-[#4a4a4a] font-mono w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-[#a8a8a8] truncate">{p.name}</p>
                      <p className="text-[10px] text-[#606060]">{p.units} unidades</p>
                    </div>
                    <p className="text-[11px] font-semibold text-white shrink-0">
                      {formatCurrency(p.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Quick actions ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { href: '/ventas/nueva', label: 'Nueva venta',   icon: '💰', accent: 'hover:border-indigo-500/25 hover:text-white' },
          { href: '/catalogo',     label: 'Agregar producto', icon: '📦', accent: 'hover:border-violet-500/25 hover:text-white' },
          { href: '/stock',        label: 'Ajustar stock', icon: '📊', accent: 'hover:border-emerald-500/25 hover:text-white' },
          { href: '/reportes',     label: 'Ver reportes',  icon: '📈', accent: 'hover:border-amber-500/25 hover:text-white' },
        ].map(({ href, label, icon, accent }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-[#101116] px-4 py-2.5 text-[12px] text-[#828282] transition-all duration-150 ${accent}`}
          >
            <span className="text-sm">{icon}</span>
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
