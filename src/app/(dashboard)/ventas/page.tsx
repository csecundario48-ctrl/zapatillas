import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils/format'

const statusVariant: Record<string, 'default' | 'destructive' | 'secondary'> = {
  completada: 'default',
  cancelada: 'destructive',
  devolucion: 'secondary',
}

export default async function VentasPage() {
  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  const totalMes = sales
    ?.filter(s => {
      const now = new Date()
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
      return s.status === 'completada' && s.sale_date >= monthStart
    })
    .reduce((sum, s) => sum + s.total_amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ventas</h1>
          <p className="text-gray-500 text-sm">Este mes: {formatCurrency(totalMes)}</p>
        </div>
        <Link href="/ventas/nueva">
          <Button>+ Nueva venta</Button>
        </Link>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Canal</th>
              <th className="text-left p-3">Pago</th>
              <th className="text-left p-3">Total</th>
              <th className="text-left p-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {sales?.map(sale => (
              <tr key={sale.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{formatDate(sale.sale_date)}</td>
                <td className="p-3 capitalize">{sale.channel}</td>
                <td className="p-3 capitalize">{sale.payment_method}</td>
                <td className="p-3 font-medium">{formatCurrency(sale.total_amount)}</td>
                <td className="p-3">
                  <Badge variant={statusVariant[sale.status] ?? 'default'}>
                    {sale.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!sales?.length && (
          <p className="p-6 text-center text-gray-500 text-sm">No hay ventas registradas aún.</p>
        )}
      </div>
    </div>
  )
}
