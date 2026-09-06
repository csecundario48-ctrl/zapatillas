import { createClient } from '@/lib/supabase/server'
import { argDateStr, formatCurrency } from '@/lib/utils/format'
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react'
import { CashflowBarChart } from '@/components/charts/cashflow-bar-chart'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: cancelledDeposits }, { data: expenses }, { data: pendingPurchases }, { data: lineRows }] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_date, sale_items(quantity, unit_cost, subtotal, line_id)')
      .eq('status', 'completada'),
    supabase
      .from('sales')
      .select('deposit_amount, sale_date')
      .eq('status', 'cancelada')
      .gt('deposit_amount', 0),
    supabase.from('expenses').select('amount, expense_date, category, line_id'),
    supabase.from('purchases').select('total_amount').neq('payment_status', 'pagado'),
    supabase.from('business_lines').select('*').order('sort_order'),
  ])

  const now = new Date()
  const monthStart = `${argDateStr().slice(0, 7)}-01`

  const depositIncome = cancelledDeposits?.reduce((s, d) => s + d.deposit_amount, 0) ?? 0
  const monthDepositIncome = cancelledDeposits?.filter(d => d.sale_date >= monthStart).reduce((s, d) => s + d.deposit_amount, 0) ?? 0
  const totalIncome = (sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0) + depositIncome
  const monthIncome = (sales?.filter(s => s.sale_date >= monthStart).reduce((s, sale) => s + sale.total_amount, 0) ?? 0) + monthDepositIncome

  type CogsItem = { quantity: number; unit_cost: number }
  const totalCOGS = sales?.reduce(
    (s, sale) =>
      s + ((sale.sale_items ?? []) as unknown as CogsItem[]).reduce(
        (si, item) => si + item.unit_cost * item.quantity, 0
      ), 0
  ) ?? 0

  const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const monthExpenses = expenses?.filter(e => e.expense_date >= monthStart).reduce((s, e) => s + e.amount, 0) ?? 0
  const pendingPayments = pendingPurchases?.reduce((s, p) => s + p.total_amount, 0) ?? 0

  const grossProfit = totalIncome - totalCOGS
  const netProfit = grossProfit - totalExpenses
  const monthNetProfit = monthIncome - monthExpenses

  const expenseByCategory = expenses?.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {} as Record<string, number>) ?? {}

  // Resultado por rubro: ingresos, costo de mercadería y gastos directos.
  // Los ingresos/costos se derivan del snapshot line_id de cada sale_item; los
  // gastos e ingresos sin rubro (señas de encargos cancelados) van a "General".
  const GENERAL = '__general__'
  const lines = (lineRows as import('@/types/database').BusinessLine[] | null) ?? []
  const lineName = (id: string) => (id === GENERAL ? 'General / Compartido' : lines.find(l => l.id === id)?.name ?? 'General / Compartido')

  type LineAgg = { income: number; cogs: number; expenses: number }
  const byLine = new Map<string, LineAgg>()
  const bucket = (id: string) => {
    const b = byLine.get(id) ?? { income: 0, cogs: 0, expenses: 0 }
    byLine.set(id, b)
    return b
  }
  type SaleLineItem = { quantity: number; unit_cost: number; subtotal: number; line_id: string | null }
  for (const sale of sales ?? []) {
    for (const item of ((sale.sale_items ?? []) as unknown as SaleLineItem[])) {
      const b = bucket(item.line_id ?? GENERAL)
      b.income += item.subtotal
      b.cogs += item.unit_cost * item.quantity
    }
  }
  for (const d of cancelledDeposits ?? []) bucket(GENERAL).income += d.deposit_amount
  for (const e of expenses ?? []) bucket(e.line_id ?? GENERAL).expenses += e.amount

  // Orden: rubros por sort_order, y General al final.
  const lineResult = [...byLine.entries()]
    .map(([id, agg]) => ({ id, name: lineName(id), ...agg, net: agg.income - agg.cogs - agg.expenses }))
    .sort((a, b) => {
      if (a.id === GENERAL) return 1
      if (b.id === GENERAL) return -1
      const ai = lines.findIndex(l => l.id === a.id), bi = lines.findIndex(l => l.id === b.id)
      return ai - bi
    })

  // Flujo de caja: ingresos vs egresos de los últimos 6 meses calendario
  const cashflow = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { key, month: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, ingresos: 0, egresos: 0 }
  })
  const cashflowByKey = new Map(cashflow.map(m => [m.key, m]))
  for (const s of sales ?? []) {
    const m = cashflowByKey.get(s.sale_date.slice(0, 7))
    if (m) m.ingresos += s.total_amount
  }
  for (const d of cancelledDeposits ?? []) {
    const m = cashflowByKey.get(d.sale_date.slice(0, 7))
    if (m) m.ingresos += d.deposit_amount
  }
  for (const e of expenses ?? []) {
    const m = cashflowByKey.get(e.expense_date.slice(0, 7))
    if (m) m.egresos += e.amount
  }

  return (
    <div className="space-y-7 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Finanzas</h1>
        <p className="text-sm text-foreground/55 mt-0.5">Resumen financiero acumulado</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em]">Ingresos totales</p>
            <TrendingUp size={16} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-mono text-[26px] font-semibold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-foreground/45 mt-1">Este mes: {formatCurrency(monthIncome)}</p>
        </div>

        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em]">Costos totales</p>
            <TrendingDown size={16} className="text-red-600 dark:text-red-400" />
          </div>
          <p className="font-mono text-[26px] font-semibold tabular-nums tracking-tight text-red-600 dark:text-red-400">{formatCurrency(totalCOGS + totalExpenses)}</p>
          <p className="text-xs text-foreground/45 mt-1">
            Mercadería: {formatCurrency(totalCOGS)} · Gastos: {formatCurrency(totalExpenses)}
          </p>
        </div>

        <div className={`border rounded-xl p-6 ${netProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em]">Ganancia neta</p>
            <DollarSign size={16} className={netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'} />
          </div>
          <p className={`font-mono text-[26px] font-semibold tabular-nums tracking-tight ${netProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-xs text-foreground/45 mt-1">Este mes: {formatCurrency(monthNetProfit)}</p>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <p className="font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] mb-3">Ganancia bruta</p>
          <p className="font-mono text-[22px] font-semibold tabular-nums tracking-tight text-foreground">{formatCurrency(grossProfit)}</p>
          <p className="text-xs text-foreground/45 mt-1">Ventas − Costo de mercadería</p>
          {totalIncome > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-foreground/55 mb-1">
                <span>Margen bruto</span>
                <span>{((grossProfit / totalIncome) * 100).toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-400 rounded-full"
                  style={{ width: `${Math.max(0, Math.min(100, (grossProfit / totalIncome) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {pendingPayments > 0 && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
              <p className="font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em]">Pagos pendientes a proveedores</p>
            </div>
            <p className="font-mono text-[22px] font-semibold tabular-nums tracking-tight text-amber-600 dark:text-amber-400">{formatCurrency(pendingPayments)}</p>
            <p className="text-xs text-foreground/45 mt-1">No incluido en los egresos hasta que se pague</p>
          </div>
        )}
      </div>

      {/* Cashflow por mes */}
      <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4">Flujo de caja — últimos 6 meses</h2>
        <CashflowBarChart data={cashflow.map(({ month, ingresos, egresos }) => ({ month, ingresos, egresos }))} />
      </div>

      {/* Resultado por rubro */}
      {lineResult.length > 0 && (
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Resultado por rubro</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/[0.06]">
                  <th className="text-left px-3 py-2 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Rubro</th>
                  <th className="text-right px-3 py-2 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Ingresos</th>
                  <th className="text-right px-3 py-2 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Mercadería</th>
                  <th className="text-right px-3 py-2 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Gastos</th>
                  <th className="text-right px-3 py-2 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Neto</th>
                </tr>
              </thead>
              <tbody>
                {lineResult.map(r => (
                  <tr key={r.id} className="border-b border-foreground/[0.05]">
                    <td className="px-3 py-2.5 text-foreground/90">{r.name}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{formatCurrency(r.income)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground/70">{formatCurrency(r.cogs)}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-foreground/70">{formatCurrency(r.expenses)}</td>
                    <td className={`px-3 py-2.5 text-right font-mono font-semibold tabular-nums ${r.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatCurrency(r.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-foreground/45 mt-3">Los gastos “General / Compartido” no se prorratean entre rubros.</p>
        </div>
      )}

      {/* Expenses by category */}
      {Object.keys(expenseByCategory).length > 0 && (
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <h2 className="text-sm font-semibold text-foreground mb-4">Egresos por categoría</h2>
          <div className="space-y-3">
            {Object.entries(expenseByCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, amount]) => (
                <div key={cat} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-foreground/60 capitalize">{cat}</div>
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-400 rounded-full"
                      style={{ width: `${(amount / totalExpenses) * 100}%` }}
                    />
                  </div>
                  <div className="w-20 text-xs text-right text-foreground/70">{formatCurrency(amount)}</div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
