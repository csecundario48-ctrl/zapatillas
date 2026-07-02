import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils/format'
import { TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react'

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: expenses }, { data: pendingPurchases }] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_date, sale_items(quantity, products(cost_price))')
      .eq('status', 'completada'),
    supabase.from('expenses').select('amount, expense_date, category'),
    supabase.from('purchases').select('total_amount').neq('payment_status', 'pagado'),
  ])

  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  const totalIncome = sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const monthIncome = sales?.filter(s => s.sale_date >= monthStart).reduce((s, sale) => s + sale.total_amount, 0) ?? 0

  const totalCOGS = sales?.reduce(
    (s, sale) =>
      s + ((sale.sale_items as any[]) ?? []).reduce(
        (si: number, item: any) => si + (item.products?.cost_price ?? 0) * item.quantity, 0
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
            <p className="text-xs text-foreground/55 uppercase tracking-wider">Ingresos totales</p>
            <TrendingUp size={16} className="text-emerald-400" />
          </div>
          <p className="text-3xl font-bold text-emerald-400">{formatCurrency(totalIncome)}</p>
          <p className="text-xs text-foreground/45 mt-1">Este mes: {formatCurrency(monthIncome)}</p>
        </div>

        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-foreground/55 uppercase tracking-wider">Costos totales</p>
            <TrendingDown size={16} className="text-red-400" />
          </div>
          <p className="text-3xl font-bold text-red-400">{formatCurrency(totalCOGS + totalExpenses)}</p>
          <p className="text-xs text-foreground/45 mt-1">
            Mercadería: {formatCurrency(totalCOGS)} · Gastos: {formatCurrency(totalExpenses)}
          </p>
        </div>

        <div className={`border rounded-xl p-6 ${netProfit >= 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-foreground/55 uppercase tracking-wider">Ganancia neta</p>
            <DollarSign size={16} className={netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'} />
          </div>
          <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(netProfit)}
          </p>
          <p className="text-xs text-foreground/45 mt-1">Este mes: {formatCurrency(monthNetProfit)}</p>
        </div>
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-6">
          <p className="text-xs text-foreground/55 uppercase tracking-wider mb-3">Ganancia bruta</p>
          <p className="text-2xl font-bold text-foreground">{formatCurrency(grossProfit)}</p>
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
              <AlertCircle size={14} className="text-amber-400" />
              <p className="text-xs text-foreground/55 uppercase tracking-wider">Pagos pendientes a proveedores</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(pendingPayments)}</p>
            <p className="text-xs text-foreground/45 mt-1">No incluido en los egresos hasta que se pague</p>
          </div>
        )}
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
