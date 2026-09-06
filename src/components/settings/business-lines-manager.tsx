'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { addBusinessLine, renameBusinessLine, deleteBusinessLine } from '@/app/actions/catalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BusinessLine } from '@/types/database'

export function BusinessLinesManager({ lines }: { lines: BusinessLine[] }) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function onAdd() {
    if (!newName.trim()) return
    setBusy(true)
    const { error } = await addBusinessLine(newName)
    setBusy(false)
    if (error) { toast.error(error); return }
    setNewName('')
    toast.success('Rubro agregado')
    router.refresh()
  }

  async function onRename(id: string) {
    setBusy(true)
    const { error } = await renameBusinessLine(id, editName)
    setBusy(false)
    if (error) { toast.error(error); return }
    setEditingId(null)
    toast.success('Rubro renombrado')
    router.refresh()
  }

  async function onDelete(id: string) {
    setBusy(true)
    const { error } = await deleteBusinessLine(id)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Rubro borrado')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Rubros</h2>
        <p className="text-xs text-foreground/50 mt-0.5">Líneas de negocio para separar la plata (ej. Zapatillas, Ropa).</p>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
          placeholder="Nuevo rubro (ej. Accesorios)"
        />
        <Button onClick={onAdd} disabled={busy || !newName.trim()}>Agregar</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {lines.map(l => (
          <div key={l.id} className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] bg-background/50 pl-3 pr-1.5 py-1.5">
            {editingId === l.id ? (
              <>
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-7 w-32" />
                <button type="button" onClick={() => onRename(l.id)} disabled={busy} className="p-1 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Guardar"><Check size={14} /></button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1 rounded-md text-foreground/45 hover:bg-foreground/[0.06] transition-colors" title="Cancelar"><X size={14} /></button>
              </>
            ) : (
              <>
                <span className="text-sm text-foreground/90">{l.name}</span>
                <button type="button" onClick={() => { setEditingId(l.id); setEditName(l.name) }} className="p-1 rounded-md text-foreground/45 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Renombrar"><Pencil size={13} /></button>
                <button type="button" onClick={() => onDelete(l.id)} disabled={busy} className="p-1 rounded-md text-foreground/45 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Borrar"><Trash2 size={13} /></button>
              </>
            )}
          </div>
        ))}
        {lines.length === 0 && <p className="py-2 text-sm text-foreground/45">No hay rubros todavía.</p>}
      </div>
    </div>
  )
}
