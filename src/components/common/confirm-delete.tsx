'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ConfirmDeleteProps {
  onConfirm: () => Promise<{ error?: string }>
  title?: string
}

export function ConfirmDelete({ onConfirm, title = 'Eliminar' }: ConfirmDeleteProps) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    const { error } = await onConfirm()
    setLoading(false)
    if (error) {
      toast.error(error)
      setConfirming(false)
    } else {
      toast.success('Eliminado')
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title={title}
        className="p-1.5 rounded-md text-foreground/45 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 size={14} />
      </button>
    )
  }

  return (
    <div className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={loading}
        onClick={handle}
        className="px-2 py-1 rounded-md text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
      >
        {loading ? '...' : 'Borrar'}
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

/** Friendly message for common Postgres errors when deleting. */
export function deleteErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23503') {
    return 'Tiene ventas o compras en el historial: borrarlo dejaría esos registros rotos. Para ocultarlo, editalo y desmarcá "Producto activo". Para vaciar todo y cargar de nuevo: node scripts/reset-datos.mjs'
  }
  return error.message
}
