import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import { remainingAmount } from '@/lib/utils/deposit'
import { EncargoRowActions } from '@/components/encargos/encargo-row-actions'

type EncargoRow = {
  id: string
  sale_date: string
  total_amount: number
  deposit_amount: number
  customers: { name: string } | null
  sale_items: { product_label: string | null; size_label: string | null; quantity: number }[]
}

export default async function EncargosPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('sales')
    .select('id, sale_date, total_amount, deposit_amount, customers(name), sale_items(product_label, size_label, quantity)')
    .eq('status', 'encargo')
    .order('sale_date', { ascending: false })

  const encargos = (data as unknown as EncargoRow[] | null) ?? []

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Encargos</h1>
        <p className="text-sm text-foreground/55 mt-0.5">{encargos.length} pendientes de entrega</p>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
        {encargos.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-background">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Producto</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Seña</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Resto</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {encargos.map(e => (
                  <tr key={e.id} className="border-b border-foreground/[0.06]">
                    <td className="px-4 py-3 font-mono text-[12px] text-foreground/70">{formatDate(e.sale_date)}</td>
                    <td className="px-4 py-3 text-foreground/85">{e.customers?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-foreground/70">
                      {(e.sale_items ?? []).map((it, i) => (
                        <div key={i} className="text-[12px]">
                          {it.product_label ?? 'Producto'}{it.size_label ? ` T${it.size_label}` : ''}
                          <span className="text-foreground/45"> ×{it.quantity}</span>
                        </div>
                      ))}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-foreground tabular-nums">{formatCurrency(e.total_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">{formatCurrency(e.deposit_amount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-600 dark:text-amber-400 tabular-nums">{formatCurrency(remainingAmount(e.total_amount, e.deposit_amount))}</td>
                    <td className="px-4 py-3">
                      <EncargoRowActions saleId={e.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <p className="text-foreground/45 text-sm">No hay encargos pendientes.</p>
            <Link href="/ventas/nueva" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Registrar un encargo desde Nueva venta →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
