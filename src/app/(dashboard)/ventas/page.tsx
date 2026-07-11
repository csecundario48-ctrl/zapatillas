import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { argDateStr, formatCurrency, formatDate } from '@/lib/utils/format'
import { SaleRowActions } from '@/components/sales/sale-row-actions'
import { ExportCsvButton } from '@/components/common/export-csv-button'

const statusStyle: Record<string, string> = {
  completada: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  cancelada: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  devolucion: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
}

const channelStyle: Record<string, string> = {
  fisica: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  online: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
}

export default async function VentasPage() {
  const supabase = await createClient()
  const { data: sales } = await supabase
    .from('sales')
    .select('*, customers(name)')
    .order('created_at', { ascending: false })
    .limit(100)

  const monthStart = `${argDateStr().slice(0, 7)}-01`
  const totalMes =
    sales
      ?.filter(s => s.status === 'completada' && s.sale_date >= monthStart)
      .reduce((sum, s) => sum + s.total_amount, 0) ?? 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Ventas</h1>
          <p className="text-sm text-foreground/55 mt-0.5">Este mes: {formatCurrency(totalMes)}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportCsvButton
            filename="ventas.csv"
            headers={['Fecha', 'Cliente', 'Canal', 'Pago', 'Estado', 'Total']}
            rows={(sales ?? []).map(s => [
              s.sale_date,
              (s.customers as { name: string } | null)?.name ?? 'Mostrador',
              s.channel,
              s.payment_method,
              s.status,
              s.total_amount,
            ])}
          />
          <Link
            href="/ventas/nueva"
            className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/15 transition-colors"
          >
            + Nueva venta
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
        {sales && sales.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-background">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Cliente</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Canal</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Pago</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Total</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map(sale => (
                <tr key={sale.id} className="border-b border-foreground/[0.06] hover:bg-foreground/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground/70">{formatDate(sale.sale_date)}</td>
                  <td className="px-4 py-3 text-foreground/70">
                    {(sale.customers as { name: string } | null)?.name ?? <span className="text-foreground/40">Mostrador</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border capitalize ${channelStyle[sale.channel] ?? ''}`}>
                      {sale.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-foreground/70 capitalize">{sale.payment_method}</td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground tabular-nums">{formatCurrency(sale.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${statusStyle[sale.status] ?? ''}`}>
                      {sale.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <SaleRowActions saleId={sale.id} status={sale.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-foreground/45 text-sm">No hay ventas registradas aún.</p>
            <Link href="/ventas/nueva" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Registrar primera venta →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
