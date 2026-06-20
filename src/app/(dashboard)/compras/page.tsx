import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import type { Purchase, Supplier } from '@/types/database'

type PurchaseWithSupplier = Purchase & { suppliers: Pick<Supplier, 'name'> | null }

export default async function ComprasPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: purchasesRaw } = await supabase
    .from('purchases')
    .select('*, suppliers(name)')
    .order('created_at', { ascending: false })

  const purchases = purchasesRaw as PurchaseWithSupplier[] | null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Compras a Proveedores</h1>
        <Link href="/compras/nueva">
          <Button>+ Nueva compra</Button>
        </Link>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Proveedor</th>
              <th className="text-left p-3">Total</th>
              <th className="text-left p-3">Pago</th>
              <th className="text-left p-3">Vencimiento</th>
            </tr>
          </thead>
          <tbody>
            {purchases?.map(p => {
              const isOverdue =
                p.payment_due_date &&
                p.payment_due_date < today &&
                p.payment_status !== 'pagado'
              return (
                <tr key={p.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">{formatDate(p.purchase_date)}</td>
                  <td className="p-3">{p.suppliers?.name ?? '-'}</td>
                  <td className="p-3 font-medium">{formatCurrency(p.total_amount)}</td>
                  <td className="p-3">
                    <Badge variant={p.payment_status === 'pagado' ? 'default' : 'destructive'}>
                      {p.payment_status}
                    </Badge>
                  </td>
                  <td className="p-3">
                    {p.payment_due_date ? (
                      <span className={isOverdue ? 'text-red-600 font-bold' : ''}>
                        {formatDate(p.payment_due_date)}
                        {isOverdue && ' ⚠️'}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!purchases?.length && (
          <p className="p-6 text-center text-gray-500 text-sm">No hay compras registradas aún.</p>
        )}
      </div>
    </div>
  )
}
