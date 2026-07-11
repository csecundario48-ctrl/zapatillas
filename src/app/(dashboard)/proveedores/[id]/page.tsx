import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Purchase, Supplier } from '@/types/database'

const paymentStyle: Record<string, string> = {
  pagado: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  pendiente: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
  parcial: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
}
const deliveryStyle: Record<string, string> = {
  recibido: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  pedido: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
}

export default async function ProveedorDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const [{ data: supplier }, { data: purchasesRaw }] = await Promise.all([
    supabase.from('suppliers').select('*').eq('id', id).single(),
    supabase
      .from('purchases')
      .select('*')
      .eq('supplier_id', id)
      .order('purchase_date', { ascending: false }),
  ])

  if (!supplier) notFound()
  const s = supplier as Supplier
  const purchases = (purchasesRaw as Purchase[] | null) ?? []
  const totalComprado = purchases.reduce((sum, p) => sum + p.total_amount, 0)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <Link href="/proveedores" className="text-xs text-indigo-400 hover:text-indigo-300">← Proveedores</Link>
        <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">{s.name}</h1>
        <p className="text-sm text-foreground/55 mt-0.5">
          {s.contact_name ? `${s.contact_name} · ` : ''}{s.phone ?? 'sin teléfono'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-4">
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{purchases.length}</p>
          <p className="text-xs text-foreground/55 mt-1">Compras</p>
        </div>
        <div className="bg-card border border-foreground/[0.08] rounded-xl p-4">
          <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(totalComprado)}</p>
          <p className="text-xs text-foreground/55 mt-1">Total comprado</p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
        {purchases.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-background">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Total</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Pago</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em] font-medium">Entrega</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} className="border-b border-foreground/[0.06]">
                  <td className="px-4 py-3 font-mono text-[12px] text-foreground/70">{formatDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground tabular-nums">{formatCurrency(p.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${paymentStyle[p.payment_status] ?? ''}`}>{p.payment_status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${deliveryStyle[p.delivery_status] ?? ''}`}>{p.delivery_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-foreground/45 text-sm">Este proveedor no tiene compras registradas.</p>
          </div>
        )}
      </div>
    </div>
  )
}
