import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils/format'

export default async function FinanzasPage() {
  const supabase = await createClient()

  const [{ data: sales }, { data: expenses }, { data: pendingPurchases }] = await Promise.all([
    supabase
      .from('sales')
      .select('total_amount, sale_date, sale_items(quantity, products(cost_price))')
      .eq('status', 'completada'),
    supabase.from('expenses').select('amount, expense_date, category'),
    supabase
      .from('purchases')
      .select('total_amount')
      .neq('payment_status', 'pagado'),
  ])

  const totalIncome = sales?.reduce((s, sale) => s + sale.total_amount, 0) ?? 0
  const totalCOGS =
    sales?.reduce(
      (s, sale) =>
        s +
        ((sale.sale_items as any[]) ?? []).reduce(
          (si: number, item: any) => si + (item.products?.cost_price ?? 0) * item.quantity,
          0
        ),
      0
    ) ?? 0
  const totalExpenses = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const pendingPayments = pendingPurchases?.reduce((s, p) => s + p.total_amount, 0) ?? 0
  const grossProfit = totalIncome - totalCOGS
  const netProfit = grossProfit - totalExpenses

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Finanzas</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Ingresos totales por ventas</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Costo mercadería + Egresos</p>
          <p className="text-3xl font-bold text-red-500 mt-1">{formatCurrency(totalCOGS + totalExpenses)}</p>
          <p className="text-xs text-gray-400 mt-1">
            Costo: {formatCurrency(totalCOGS)} | Gastos: {formatCurrency(totalExpenses)}
          </p>
        </div>
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Ganancia neta acumulada</p>
          <p className={`text-3xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(netProfit)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border rounded-lg p-6">
          <p className="text-gray-500 text-sm">Ganancia bruta</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(grossProfit)}</p>
          <p className="text-xs text-gray-400 mt-1">Ventas − Costo de mercadería</p>
        </div>
        {pendingPayments > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-700 text-sm font-medium">Pagos pendientes a proveedores</p>
            <p className="text-2xl font-bold text-yellow-800 mt-1">{formatCurrency(pendingPayments)}</p>
            <p className="text-xs text-yellow-600 mt-1">No incluido en los egresos hasta que se pague</p>
          </div>
        )}
      </div>
    </div>
  )
}
