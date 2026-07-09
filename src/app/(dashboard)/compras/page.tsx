import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { argDateStr, formatCurrency, formatDate } from '@/lib/utils/format'
import type { Purchase, Supplier } from '@/types/database'

type PurchaseWithSupplier = Purchase & { suppliers: Pick<Supplier, 'name'> | null }

const paymentStyle: Record<string, string> = {
  pagado: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  pendiente: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  parcial: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}

export default async function ComprasPage() {
  const supabase = await createClient()
  const today = argDateStr()

  const { data: purchasesRaw } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false })

  const purchases = purchasesRaw as PurchaseWithSupplier[] | null

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Compras a Proveedores</h1>
          <p className="text-sm text-[#828282] mt-0.5">{purchases?.length ?? 0} compras registradas</p>
        </div>
        <Link
          href="/compras/nueva"
          className="px-4 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-medium hover:bg-indigo-500/15 transition-colors"
        >
          + Nueva compra
        </Link>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#15161c] overflow-x-auto">
        {purchases && purchases.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#0a0a0a]">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Proveedor</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Total</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Pago</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Vencimiento</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => {
                const isOverdue =
                  p.payment_due_date && p.payment_due_date < today && p.payment_status !== 'pagado'
                return (
                  <tr key={p.id} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 font-mono text-[12px] text-[#8a8f98]">{formatDate(p.purchase_date)}</td>
                    <td className="px-4 py-3 text-white font-medium">{p.suppliers?.name ?? '-'}</td>
                    <td className="px-4 py-3 font-mono font-medium text-white tabular-nums">{formatCurrency(p.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${paymentStyle[p.payment_status] ?? ''}`}>
                        {p.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.payment_due_date ? (
                        <span className={`font-mono text-[12px] ${isOverdue ? 'text-red-400 font-medium' : 'text-[#8a8f98]'}`}>
                          {formatDate(p.payment_due_date)}
                          {isOverdue && ' ⚠'}
                        </span>
                      ) : (
                        <span className="text-[#6e6e6e]">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-[#6e6e6e] text-sm">No hay compras registradas aún.</p>
            <Link href="/compras/nueva" className="inline-block mt-3 text-xs text-indigo-400 hover:text-indigo-300 underline">
              Registrar primera compra →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
