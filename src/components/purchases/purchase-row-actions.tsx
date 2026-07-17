'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { receivePurchase, deletePurchase } from '@/app/actions/purchases'
import { RowMenu } from '@/components/common/row-menu'

interface PurchaseRowActionsProps {
  purchaseId: string
  deliveryStatus: 'pedido' | 'recibido'
}

export function PurchaseRowActions({ purchaseId, deliveryStatus }: PurchaseRowActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onReceive() {
    setLoading(true)
    const { error } = await receivePurchase(purchaseId)
    setLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Compra marcada como recibida — stock sumado')
    router.refresh()
  }

  async function onDelete() {
    const { error } = await deletePurchase(purchaseId)
    if (error) return { error }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {deliveryStatus === 'pedido' && (
        <button
          type="button"
          onClick={onReceive}
          disabled={loading}
          className="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Marcar recibida'}
        </button>
      )}
      <RowMenu
        onDelete={onDelete}
        deleteLabel="Eliminar compra"
        confirmDescription={
          deliveryStatus === 'recibido'
            ? 'Se borra la compra y sus unidades se restan del stock. No se puede deshacer.'
            : 'Se borra la compra. El stock no se modifica. No se puede deshacer.'
        }
        editHref={`/compras/${purchaseId}/editar`}
        editLabel="Editar compra"
      />
    </div>
  )
}
