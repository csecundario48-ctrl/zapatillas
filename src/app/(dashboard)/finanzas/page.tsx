import { createClient } from '@/lib/supabase/server'
import { argDateStr, formatCurrency } from '@/lib/utils/format'
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react'
import { CashflowBarChart } from '@/components/charts/cashflow-bar-chart'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: expenses }, { data: pendingPurchases }] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_date, sale_items(quantity, product_variants(products(cost_price)))')
      .eq('status', 'completada'),
    supabase.from('expenses').select('amount, expense_date, category'),
    supabase.from('purchases').select('total_amount').neq('payment_status', 'pagado'),
  ])

  const now = new Date()
  const monthStart = `${argDateStr().slice(0, 7)}-01`

  const totalIncome = sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const monthIncome = sales?.filter(s => s.sale_date >= monthStart).reduce((s, sale) => s + sale.total_amount, 0) ?? 0

  type CogsItem = { quantity: number; product_variants: { products: { cost_price: number } | null } | null }
  const totalCOGS = sales?.reduce(
    (s, sale) =>
      s + ((sale.sale_items ?? []) as unknown as CogsItem[]).reduce(
        (si, item) => si + (item.product_variants?.products?.cost_price ?? 0) * item.quantity, 0
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
