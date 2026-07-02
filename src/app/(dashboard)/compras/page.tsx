import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Purchase, Supplier } from '@/types/database'

type PurchaseWithSupplier = Purchase & { suppliers: Pick<Supplier, 'name'> | null }

const paymentStyle: Record<string, string> = {
  pagado: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  pendiente: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  parcial: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}

export default async function ComprasPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: purchasesRaw } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false })

  const purchases = purchasesRaw as PurchaseWithSupplier[] | null

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Compras a Proveedores</h1>
          <p className="text-sm text-foreground/55 mt-0.5">{purchases?.length ?? 0} compras registradas</p>
        </div>
        <Link
          href="/compras/nueva"
          className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/15 transition-colors"
        >
          + Nueva compra
        </Link>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
        {purchases && purchases.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-background">
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider font-medium">Fecha</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider font-medium">Proveedor</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider font-medium">Total</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider font-medium">Pago</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider font-medium">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => {
                const isOverdue =
                  p.payment_due_date && p.payment_due_date < today && p.payment_status !== 'pagado'
                return (
                  <tr key={p.id} className="border-b border-foreground/[0.06] hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3 text-foreground/90">{formatDate(p.purchase_date)}</td>
                    <td className="px-4 py-3 text-foreground font-medium">{p.suppliers?.name ?? '-'}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{formatCurrency(p.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${paymentStyle[p.payment_status] ?? ''}`}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.payment_due_date ? (
                        <span className={isOverdue ? 'text-red-400 font-medium' : 'text-foreground/70'}>
                          {formatDate(p.payment_due_date)}
                          {isOverdue && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-foreground/45">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-foreground/45 text-sm">No hay compras registradas aún.</p>
            <Link href="/compras/nueva" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Registrar primera compra →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
