'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { completeEncargo, cancelEncargo, deleteSale } from '@/app/actions/sales'
import { RowMenu } from '@/components/common/row-menu'
import type { PaymentMethod } from '@/types/database'

export function EncargoRowActions({ saleId }: { saleId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [method, setMethod] = useState<PaymentMethod>('efectivo')

  async function onComplete() {
    setLoading(true)
    const { error } = await completeEncargo(saleId, method)
    setLoading(false)
    setCompleting(false)
    if (error) { toast.error(error); return }
    toast.success('Encargo completado — stock descontado')
    router.refresh()
  }

  async function onDelete() {
    const { error } = await deleteSale(saleId)
    if (error) return { error }
    router.refresh()
    return {}
  }

  async function onCancel() {
    setLoading(true)
    const { error } = await cancelEncargo(saleId)
    setLoading(false)
    setCancelling(false)
    if (error) { toast.error(error); return }
    toast.success('Encargo cancelado — la seña queda registrada')
    router.refresh()
  }

  if (completing) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <select
          value={method}
          onChange={e => setMethod(e.target.value as PaymentMethod)}
          className="bg-card border border-foreground/10 text-foreground rounded-md px-2 py-1 text-xs focus:outline-none focus:border-indigo-500/50"
        >
          <option value="efectivo" className="bg-card">Efectivo</option>
          <option value="transferencia" className="bg-card">Transferencia</option>
          <option value="tarjeta" className="bg-card">Tarjeta</option>
          <option value="mercadopago" className="bg-card">MercadoPago</option>
        </select>
        <button
          type="button"
          disabled={loading}
          onClick={onComplete}
          className="px-2 py-1 rounded-md text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Confirmar'}
        </button>
        <button type="button" onClick={() => setCompleting(false)} className="px-2 py-1 rounded-md text-[11px] text-foreground/60 hover:text-foreground transition-colors">Volver</button>
      </div>
    )
  }

  if (cancelling) {
    return (
      <div className="inline-flex items-center gap-1">
        <button
          type="button"
          disabled={loading}
          onClick={onCancel}
          className="px-2 py-1 rounded-md text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Cancelar encargo'}
        </button>
        <button type="button" onClick={() => setCancelling(false)} className="px-2 py-1 rounded-md text-[11px] text-foreground/60 hover:text-foreground transition-colors">Volver</button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => setCompleting(true)}
        className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors"
      >
        Completar entrega
      </button>
      <button
        type="button"
        onClick={() => setCancelling(true)}
        className="px-2.5 py-1 rounded-md text-foreground/55 hover:text-red-600 dark:hover:text-red-400 text-xs font-medium transition-colors"
      >
        Cancelar
      </button>
      <RowMenu
        onDelete={onDelete}
        deleteLabel="Eliminar encargo"
        confirmDescription="Se borra el encargo y la seña deja de contarse en Finanzas. El stock no se modifica. No se puede deshacer."
        editHref={`/ventas/${saleId}/editar`}
        editLabel="Editar encargo"
      />
    </div>
  )
}
