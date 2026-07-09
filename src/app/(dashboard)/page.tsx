import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/kpis/kpi-card'
import { argDateStr, formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight, Plus, ShoppingCart, Package, Boxes, BarChart3 } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()

  const now = new Date()
  const todayStr = argDateStr(now)
  const monthStart = `${todayStr.slice(0, 7)}-01`
  const monthName = now.toLocaleDateString('es-AR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  })

  const dayMs = 86_400_000
  const dayStr = (offset: number) => argDateStr(new Date(now.getTime() - offset * dayMs))
  const last7Start = dayStr(6)   // last 7 days (incl. today)
  const prev7Start = dayStr(13)  // the 7 days before that

  const [
    { data: monthlySales },
    { data: todaySalesRaw },
    { data: monthlyExpenses },
    { data: stockAlerts },
    { data: overduePurchases },
    { data: recentSales },
    { data: topProducts },
    { count: totalActiveProducts },
    { data: stockValProducts },
    { data: monthlyPurchasesData },
    { data: recentExpensesData },
    { data: weekSales },
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
      .select('quantity, unit_price, products(brand, model), sales!inner(sale_date, status)')
      .gte('sales.sale_date', monthStart)
      .eq('sales.status', 'completada')
      .limit(200),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('active', true),
    supabase.from('products').select('cost_price, stock_quantity').eq('active', true),
    supabase.from('purchases').select('total_amount').gte('purchase_date', monthStart),
    supabase
      .from('expenses')
      .select('category, description, amount, expense_date')
      .order('expense_date', { ascending: false })
      .limit(5),
    supabase
      .from('sales')
      .select('sale_date, total_amount')
      .eq('status', 'completada')
      .gte('sale_date', prev7Start),
  ])

  // KPI calculations
  const totalIncome = monthlySales?.reduce((s, x) => s + x.total_amount, 0) ?? 0
  const todayIncome = todaySalesRaw?.reduce((s, x) => s + x.total_amount, 0) ?? 0
  type CogsItem = { quantity: number; products: { cost_price: number } | null }
  const totalCOGS = monthlySales?.reduce(
    (s, sale) =>
      s +
      ((sale.sale_items ?? []) as unknown as CogsItem[]).reduce(
        (si, item) => si + (item.products?.cost_price ?? 0) * item.quantity,
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

  // Stock valorizado (costo del inventario actual)
  const stockValue = (stockValProducts ?? []).reduce(
    (s, p) => s + (p.cost_price ?? 0) * (p.stock_quantity ?? 0), 0
  )

  // Flujo de caja del mes: ingresos (ventas) vs egresos (compras + gastos)
  const monthPurchases = monthlyPurchasesData?.reduce((s, p) => s + p.total_amount, 0) ?? 0
  const cashOut = monthPurchases + totalExpenses
  const cashNet = totalIncome - cashOut

  // Alerta de caída de ventas: últimos 7 días vs los 7 anteriores
  let thisWeek = 0, lastWeek = 0
  for (const s of weekSales ?? []) {
    if (s.sale_date >= last7Start) thisWeek += s.total_amount
    else lastWeek += s.total_amount
  }
  const salesDropPct = lastWeek > 0 ? Math.round(((lastWeek - thisWeek) / lastWeek) * 100) : 0
  const showSalesDrop = lastWeek > 0 && thisWeek < lastWeek && salesDropPct >= 15

  const expenseCatLabel: Record<string, string> = {
    alquiler: 'Alquiler', servicios: 'Servicios', marketing: 'Marketing', delivery: 'Envíos',
    salarios: 'Sueldos', packaging: 'Packaging', otros: 'Otros',
  }

  // Top products from sale_items
  const productMap: Record<string, { name: string; units: number; revenue: number }> = {}
  for (const item of topProducts ?? []) {
    const p = item.products as unknown as { brand: string; model: string } | null
    if (!p) continue
    const key = `${p.brand} ${p.model}`
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
      <div className="relative rounded-2xl border border-foreground/[0.06] bg-card overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_50%,rgba(99,102,241,0.05)_0%,rgba(167,139,250,0.03)_40%,transparent_70%)]" />
        <div className="relative">
          {/* Stats */}
          <div className="px-7 py-7">
            <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.2em] font-medium mb-2">
              KALA · {monthName}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-foreground mb-5">
              Resumen del negocio
            </p>
            <div className="flex flex-wrap gap-5">
              <div>
                <p className="font-mono text-xl font-semibold text-indigo-400 tracking-tight tabular-nums">{formatCurrency(totalIncome)}</p>
                <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mt-1">Ventas mes</p>
              </div>
              <div className="w-px bg-border self-stretch" />
              <div>
                <p className={`font-mono text-xl font-semibold tracking-tight tabular-nums ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatCurrency(netProfit)}
                </p>
                <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mt-1">Ganancia neta</p>
              </div>
              <div className="w-px bg-border self-stretch" />
              <div>
                <p className="font-mono text-xl font-semibold text-violet-400 tracking-tight tabular-nums">{margin}%</p>
                <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mt-1">Margen</p>
              </div>
              <div className="w-px bg-border self-stretch" />
              <div>
                <p className="font-mono text-xl font-semibold text-amber-600 dark:text-amber-400 tracking-tight tabular-nums">{formatCurrency(todayIncome)}</p>
                <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mt-1">Ventas hoy</p>
              </div>
            </div>
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

      {/* ─── Flujo de caja del mes ─── */}
      <div className="rounded-xl border border-foreground/[0.06] bg-card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-foreground/[0.06] flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-foreground">Flujo de caja · {monthName}</h2>
          <Link href="/finanzas" className="text-[11px] text-foreground/45 hover:text-indigo-400 flex items-center gap-1 transition-colors">
            Finanzas <ArrowUpRight size={11} />
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-foreground/[0.06]">
          <div className="px-5 py-4">
            <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mb-1.5">Ingresos</p>
            <p className="font-mono text-lg font-semibold text-emerald-600 dark:text-emerald-400 tracking-tight tabular-nums">{formatCurrency(totalIncome)}</p>
            <p className="text-[10px] text-foreground/40 mt-0.5">Ventas del mes</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mb-1.5">Egresos</p>
            <p className="font-mono text-lg font-semibold text-red-600 dark:text-red-400 tracking-tight tabular-nums">{formatCurrency(cashOut)}</p>
            <p className="text-[10px] text-foreground/40 mt-0.5">Compras + gastos</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mb-1.5">Caja neta</p>
            <p className={`font-mono text-lg font-semibold tracking-tight tabular-nums ${cashNet >= 0 ? 'text-foreground' : 'text-red-600 dark:text-red-400'}`}>
              {formatCurrency(cashNet)}
            </p>
            <p className="text-[10px] text-foreground/40 mt-0.5">Ingresos − egresos</p>
          </div>
          <div className="px-5 py-4">
            <p className="font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] mb-1.5">Stock valorizado</p>
            <p className="font-mono text-lg font-semibold text-indigo-400 tracking-tight tabular-nums">{formatCurrency(stockValue)}</p>
            <p className="text-[10px] text-foreground/40 mt-0.5">Costo del inventario</p>
          </div>
        </div>
      </div>

      {/* ─── Alerts ─── */}
      {showSalesDrop && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
          <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-amber-300">
              Las ventas bajaron {salesDropPct}% respecto a la semana pasada
            </p>
            <p className="text-[11px] text-foreground/45 mt-0.5">
              Últimos 7 días: {formatCurrency(thisWeek)} · semana anterior: {formatCurrency(lastWeek)}
            </p>
          </div>
        </div>
      )}

      {(overduePurchases?.length ?? 0) > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.04]">
          <AlertTriangle size={14} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-red-300">
              {overduePurchases!.length} pago{overduePurchases!.length > 1 ? 's' : ''} vencido{overduePurchases!.length > 1 ? 's' : ''} a proveedores
            </p>
            <p className="text-[11px] text-foreground/45 mt-0.5 truncate">
              {overduePurchases!.map(p => (p.suppliers as unknown as { name: string } | null)?.name).filter(Boolean).join(', ')}
            </p>
          </div>
          <Link href="/compras" className="text-[11px] text-red-600 dark:text-red-400 hover:text-red-300 font-medium shrink-0 flex items-center gap-1 transition-colors">
            Ver <ArrowUpRight size={11} />
          </Link>
        </div>
      )}

      {/* ─── Main content grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Ventas recientes */}
        <div className="lg:col-span-2 rounded-xl border border-foreground/[0.06] bg-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
            <h2 className="text-[13px] font-semibold text-foreground">Ventas recientes</h2>
            <Link href="/ventas" className="text-[11px] text-foreground/45 hover:text-indigo-400 flex items-center gap-1 transition-colors">
              Ver todas <ArrowUpRight size={11} />
            </Link>
          </div>
          {(recentSales?.length ?? 0) === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[13px] text-foreground/40">Sin ventas registradas</p>
              <Link href="/ventas/nueva" className="mt-3 inline-flex items-center gap-1.5 text-[12px] text-indigo-400 hover:text-indigo-300 transition-colors">
                <Plus size={12} /> Registrar primera venta
              </Link>
            </div>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-foreground/[0.05]">
                  <th className="text-left px-5 py-2.5 font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] font-medium">Fecha</th>
                  <th className="text-left px-3 py-2.5 font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] font-medium">Cliente</th>
                  <th className="text-left px-3 py-2.5 font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] font-medium">Canal</th>
                  <th className="text-right px-5 py-2.5 font-mono text-[10px] text-foreground/40 uppercase tracking-[0.14em] font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentSales!.map((sale) => (
                  <tr key={sale.id} className="border-b border-foreground/[0.05] hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-5 py-3 font-mono text-[11px] text-foreground/60">
                      {new Date(sale.sale_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                    </td>
                    <td className="px-3 py-3 text-foreground/70">
                      {(sale.customers as unknown as { name: string } | null)?.name ?? <span className="text-foreground/40">—</span>}
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
                    <td className="px-5 py-3 text-right font-mono font-medium text-foreground tabular-nums">
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
          <div className="rounded-xl border border-foreground/[0.06] bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
              <h2 className="text-[13px] font-semibold text-foreground">Stock crítico</h2>
              <Link href="/stock" className="text-[11px] text-foreground/45 hover:text-indigo-400 flex items-center gap-1 transition-colors">
                Ver <ArrowUpRight size={11} />
              </Link>
            </div>
            {(stockAlerts?.length ?? 0) === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[11px] text-foreground/35">Todo el stock en orden ✓</p>
              </div>
            ) : (
              <div className="divide-y divide-foreground/[0.05]">
                {stockAlerts!.slice(0, 6).map(p => (
                  <div key={p.id} className="flex items-center justify-between px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[12px] text-foreground/70 truncate">{p.brand} {p.model}</p>
                      <p className="text-[10px] text-foreground/40">{p.color} · T{p.size}</p>
                    </div>
                    <span className={`font-mono text-[11px] font-semibold ml-3 shrink-0 tabular-nums ${
                      p.stock_quantity === 0 ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {p.stock_quantity === 0 ? 'AGOTADO' : `${p.stock_quantity} ud.`}
                    </span>
                  </div>
                ))}
                {(stockAlerts!.length ?? 0) > 6 && (
                  <div className="px-5 py-2.5">
                    <Link href="/stock" className="text-[11px] text-foreground/45 hover:text-indigo-400 transition-colors">
                      +{stockAlerts!.length - 6} más...
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Top productos */}
          <div className="rounded-xl border border-foreground/[0.06] bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-foreground/[0.06]">
              <h2 className="text-[13px] font-semibold text-foreground">Más vendidos este mes</h2>
            </div>
            {topList.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-[11px] text-foreground/35">Sin datos de ventas</p>
              </div>
            ) : (
              <div className="divide-y divide-foreground/[0.05]">
                {topList.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-3 px-5 py-2.5">
                    <span className="text-[10px] text-foreground/30 font-mono w-4 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] text-foreground/70 truncate">{p.name}</p>
                      <p className="text-[10px] text-foreground/40">{p.units} unidades</p>
                    </div>
                    <p className="font-mono text-[11px] font-medium text-foreground shrink-0 tabular-nums">
                      {formatCurrency(p.revenue)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Últimos gastos ─── */}
      <div className="rounded-xl border border-foreground/[0.06] bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-foreground/[0.06]">
          <h2 className="text-[13px] font-semibold text-foreground">Últimos gastos</h2>
          <Link href="/egresos" className="text-[11px] text-foreground/45 hover:text-indigo-400 flex items-center gap-1 transition-colors">
            Ver todos <ArrowUpRight size={11} />
          </Link>
        </div>
        {(recentExpensesData?.length ?? 0) === 0 ? (
          <div className="py-8 text-center">
            <p className="text-[11px] text-foreground/35">Sin gastos registrados</p>
          </div>
        ) : (
          <div className="divide-y divide-foreground/[0.05]">
            {recentExpensesData!.map((e, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-2.5">
                <div className="min-w-0 flex items-center gap-3">
                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-foreground/[0.04] text-foreground/70 border border-foreground/10 shrink-0">
                    {expenseCatLabel[e.category] ?? e.category}
                  </span>
                  <p className="text-[12px] text-foreground/70 truncate">
                    {e.description ?? <span className="text-foreground/40">—</span>}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-mono text-[10px] text-foreground/40">
                    {new Date(e.expense_date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
                  </span>
                  <span className="font-mono text-[12px] font-medium text-red-600 dark:text-red-400 tabular-nums">−{formatCurrency(e.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Quick actions ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { href: '/ventas/nueva', label: 'Nueva venta',      Icon: ShoppingCart, accent: 'hover:border-indigo-500/25 hover:text-foreground',  iconCls: 'text-indigo-400' },
          { href: '/catalogo',     label: 'Agregar producto', Icon: Package,      accent: 'hover:border-violet-500/25 hover:text-foreground',  iconCls: 'text-violet-400' },
          { href: '/stock',        label: 'Ajustar stock',    Icon: Boxes,        accent: 'hover:border-emerald-500/25 hover:text-foreground', iconCls: 'text-emerald-600 dark:text-emerald-400' },
          { href: '/reportes',     label: 'Ver reportes',     Icon: BarChart3,    accent: 'hover:border-amber-500/25 hover:text-foreground',   iconCls: 'text-amber-600 dark:text-amber-400' },
        ].map(({ href, label, Icon, accent, iconCls }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg border border-foreground/[0.06] bg-card px-4 py-2.5 text-[12px] text-foreground/65 transition-all duration-150 ${accent}`}
          >
            <Icon size={15} className={iconCls} />
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
