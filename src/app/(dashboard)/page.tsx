import { createClient } from '@/lib/supabase/server'
import { KpiCard } from '@/components/kpis/kpi-card'
import { formatCurrency } from '@/lib/utils/format'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function HomePage() {
  const supabase = await createClient()
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const today = now.toISOString().split('T')[0]

  const [
    { data: monthlySales },
    { data: monthlyExpenses },
    { data: stockAlerts },
    { data: overduePurchases },
  ] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_items(quantity, products(cost_price))')
      .eq('status', 'completada')
      .gte('sale_date', monthStart),
    supabase.from('expenses').select('amount').gte('expense_date', monthStart),
    supabase.from('products').select('id, brand, model, color, size, stock_quantity').eq('active', true).lte('stock_quantity', 2),
    supabase
      .from('purchases')
      .select('id, suppliers(name), payment_due_date')
      .neq('payment_status', 'pagado')
      .lt('payment_due_date', today),
  ])

  const totalIncome = monthlySales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const totalCOGS =
    monthlySales?.reduce(
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

  const criticalStock = stockAlerts?.filter(p => p.stock_quantity === 0) ?? []
  const lowStock = stockAlerts?.filter(p => p.stock_quantity > 0) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-500 text-sm">Resumen del mes actual</p>
        </div>
        <Link href="/ventas/nueva">
          <Button>+ Nueva venta</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard title="Ventas del mes" value={formatCurrency(totalIncome)} color="blue" />
        <KpiCard title="Ganancia bruta" value={formatCurrency(grossProfit)} color="green" />
        <KpiCard
          title="Ganancia neta"
          value={formatCurrency(netProfit)}
          color={netProfit >= 0 ? 'green' : 'red'}
        />
        <KpiCard
          title="Alertas de stock"
          value={String(stockAlerts?.length ?? 0)}
          subtitle="productos con stock ≤ 2"
          color={stockAlerts && stockAlerts.length > 0 ? 'yellow' : 'blue'}
        />
      </div>

      {(overduePurchases?.length ?? 0) > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 font-medium">
            💸 {overduePurchases!.length} pago{overduePurchases!.length > 1 ? 's' : ''} a proveedor vencido{overduePurchases!.length > 1 ? 's' : ''}.{' '}
            <Link href="/compras" className="underline">
              Ver compras
            </Link>
          </p>
        </div>
      )}

      {criticalStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h2 className="font-semibold text-red-700 mb-2">🔴 Sin stock ({criticalStock.length})</h2>
          <ul className="space-y-1">
            {criticalStock.slice(0, 5).map(p => (
              <li key={p.id} className="text-sm text-red-600">
                {p.brand} {p.model} — {p.color} T{p.size}
              </li>
            ))}
            {criticalStock.length > 5 && (
              <li className="text-sm text-red-500">
                <Link href="/stock" className="underline">
                  Ver {criticalStock.length - 5} más...
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="font-semibold text-yellow-700 mb-2">🟡 Stock bajo ({lowStock.length})</h2>
          <ul className="space-y-1">
            {lowStock.slice(0, 5).map(p => (
              <li key={p.id} className="text-sm text-yellow-700">
                {p.brand} {p.model} — {p.color} T{p.size} ({p.stock_quantity} ud.)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
