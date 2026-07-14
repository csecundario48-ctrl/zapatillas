'use client'

import { useState } from 'react'
import { Menu } from '@base-ui/react/menu'
import { MoreVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface RowMenuProps {
  /** Corre el borrado. Devuelve { error } para mostrarlo en un toast. */
  onDelete: () => Promise<{ error?: string }>
  /** Texto de la opción del menú: "Eliminar venta", "Eliminar egreso", etc. */
  deleteLabel?: string
  /** Aclaración dentro del diálogo de confirmación. */
  confirmDescription?: string
}

/** Menú de 3 puntitos para una fila de tabla, con la opción de eliminar. */
export function RowMenu({
  onDelete,
  deleteLabel = 'Eliminar',
  confirmDescription = 'Esta acción no se puede deshacer.',
}: RowMenuProps) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    setLoading(true)
    const { error } = await onDelete()
    setLoading(false)
    if (error) {
      toast.error(error)
      return
    }
    setConfirming(false)
    toast.success('Eliminado')
  }

  return (
    <>
      <Menu.Root>
        <Menu.Trigger
          render={
            <button
              type="button"
              title="Acciones"
              className="p-1.5 rounded-md text-foreground/45 hover:text-foreground hover:bg-foreground/[0.06] data-[popup-open]:bg-foreground/[0.06] data-[popup-open]:text-foreground transition-colors"
            />
          }
        >
          <MoreVertical size={16} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner side="bottom" align="end" sideOffset={6} className="z-50 outline-none">
            <Menu.Popup className="min-w-[168px] rounded-lg bg-popover p-1 text-sm ring-1 ring-foreground/10 shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              <Menu.Item
                onClick={() => setConfirming(true)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-md text-red-600 dark:text-red-400 cursor-pointer select-none outline-none data-highlighted:bg-red-500/10"
              >
                <Trash2 size={14} />
                {deleteLabel}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent className="bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">{deleteLabel}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
