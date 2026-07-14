'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { returnSale, deleteSale } from '@/app/actions/sales'
import { RowMenu } from '@/components/common/row-menu'

export function SaleRowActions({ saleId, status }: { saleId: string; status: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function del() {
    const { error } = await deleteSale(saleId)
    if (error) return { error }
    router.refresh()
    return {}
  }

  const menu = (
    <RowMenu
      onDelete={del}
      deleteLabel="Eliminar venta"
      confirmDescription={
        status === 'completada'
          ? 'Se borra la venta y las unidades vuelven al stock. No se puede deshacer.'
          : 'Se borra la venta. El stock no se modifica. No se puede deshacer.'
      }
    />
  )

  if (status !== 'completada') {
    return <div className="flex items-center justify-end">{menu}</div>
  }

  async function handle() {
    setLoading(true)
    const { error } = await returnSale(saleId)
    setLoading(false)
    setConfirming(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Devolución registrada — stock repuesto')
      router.refresh()
    }
  }

  if (!confirming) {
    return (
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => setConfirming(true)}
          title="Registrar devolución"
          className="p-1.5 rounded-md text-foreground/45 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
        >
          <Undo2 size={14} />
        </button>
        {menu}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={handle}
        className="px-2 py-1 rounded-md text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/15 disabled:opacity-50 transition-colors"
      >
        {loading ? '...' : 'Devolver'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="px-2 py-1 rounded-md text-[11px] text-foreground/60 hover:text-foreground transition-colors"
      >
        Cancelar
      </button>
    </div>
  )
}
