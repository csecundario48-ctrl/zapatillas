'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils/format'

interface HistorySale {
  id: string
  sale_date: string
  total_amount: number
  status: string
  payment_method: string
  sale_items: {
    quantity: number
    products: { brand: string; model: string; size: string; color: string } | null
  }[]
}

const statusStyle: Record<string, string> = {
  completada: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  cancelada: 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  devolucion: 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400',
}

function HistoryList({ customerId }: { customerId: string }) {
  const [sales, setSales] = useState<HistorySale[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('sales')
      .select('id, sale_date, total_amount, status, payment_method, sale_items(quantity, products(brand, model, size, color))')
      .eq('customer_id', customerId)
      .order('sale_date', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setSales((data as unknown as HistorySale[]) ?? [])
      })
  }, [customerId])

  if (error) return <p className="text-sm text-red-600 dark:text-red-400 py-6 text-center">{error}</p>
  if (sales === null) return <p className="text-sm text-foreground/45 py-6 text-center">Cargando...</p>
  if (sales.length === 0) return <p className="text-sm text-foreground/45 py-6 text-center">Este cliente todavía no tiene compras.</p>

  return (
    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
      {sales.map(sale => (
        <div key={sale.id} className="rounded-lg border border-foreground/[0.08] bg-background p-3">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-foreground/85">{formatDate(sale.sale_date)}</span>
              <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] border ${statusStyle[sale.status] ?? ''}`}>
                {sale.status}
              </span>
            </div>
            <span className="text-sm font-semibold text-foreground">{formatCurrency(sale.total_amount)}</span>
          </div>
          <p className="text-xs text-foreground/55">
            {sale.sale_items
              .map(i => {
                const p = i.products
                return p ? `${i.quantity}× ${p.brand} ${p.model} T${p.size} (${p.color})` : `${i.quantity}× producto eliminado`
              })
              .join(' · ')}
            <span className="text-foreground/40 capitalize"> — {sale.payment_method}</span>
          </p>
        </div>
      ))}
    </div>
  )
}

export function CustomerHistoryButton({ customerId, customerName }: { customerId: string; customerName: string }) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            title="Ver historial de compras"
            className="p-1.5 rounded-md text-foreground/45 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
          />
        }
      >
        <History size={14} />
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-foreground/10">
        <DialogHeader>
          <DialogTitle className="text-foreground">Historial de {customerName}</DialogTitle>
        </DialogHeader>
        {open && <HistoryList customerId={customerId} />}
      </DialogContent>
    </Dialog>
  )
}
