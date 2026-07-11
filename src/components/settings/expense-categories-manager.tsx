'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { addExpenseCategory, renameExpenseCategory, deleteExpenseCategory } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ExpenseCategoryRow } from '@/types/database'

export function ExpenseCategoriesManager({ categories }: { categories: ExpenseCategoryRow[] }) {
  const router = useRouter()
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function onAdd() {
    if (!newName.trim()) return
    setBusy(true)
    const { error } = await addExpenseCategory(newName)
    setBusy(false)
    if (error) { toast.error(error); return }
    setNewName('')
    toast.success('Categoría agregada')
    router.refresh()
  }

  async function onRename(id: string) {
    setBusy(true)
    const { error } = await renameExpenseCategory(id, editName)
    setBusy(false)
    if (error) { toast.error(error); return }
    setEditingId(null)
    toast.success('Categoría renombrada')
    router.refresh()
  }

  async function onDelete(id: string) {
    setBusy(true)
    const { error } = await deleteExpenseCategory(id)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Categoría borrada')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-6 space-y-4">
      <h2 className="text-sm font-semibold text-foreground">Categorías de gastos</h2>

      <div className="flex items-center gap-2 max-w-sm">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); onAdd() } }}
          placeholder="Nueva categoría (ej. publicidad)"
        />
        <Button onClick={onAdd} disabled={busy || !newName.trim()}>Agregar</Button>
      </div>

      <div className="divide-y divide-foreground/[0.06] border-t border-foreground/[0.06]">
        {categories.map(c => (
          <div key={c.id} className="flex items-center justify-between py-2.5">
            {editingId === c.id ? (
              <div className="flex items-center gap-2 flex-1">
                <Input value={editName} onChange={e => setEditName(e.target.value)} className="max-w-xs" />
                <button type="button" onClick={() => onRename(c.id)} disabled={busy} className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Guardar"><Check size={14} /></button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-md text-foreground/45 hover:bg-foreground/[0.06] transition-colors" title="Cancelar"><X size={14} /></button>
              </div>
            ) : (
              <>
                <span className="text-sm text-foreground/90 capitalize">{c.name}</span>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { setEditingId(c.id); setEditName(c.name) }} className="p-1.5 rounded-md text-foreground/45 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Renombrar"><Pencil size={14} /></button>
                  <button type="button" onClick={() => onDelete(c.id)} disabled={busy} className="p-1.5 rounded-md text-foreground/45 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Borrar"><Trash2 size={14} /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {categories.length === 0 && <p className="py-4 text-sm text-foreground/45">No hay categorías. Agregá la primera.</p>}
      </div>
    </div>
  )
}
