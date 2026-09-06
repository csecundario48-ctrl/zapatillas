'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Trash2, Check, X } from 'lucide-react'
import { addCategory, updateCategory, deleteCategory } from '@/app/actions/catalog'
import { parseSizeOptions, joinSizeOptions } from '@/lib/catalog/sizes'
import { CategoryAttributesPanel } from './category-attributes-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { BusinessLine, ProductCategory } from '@/types/database'

const sel = 'bg-card border border-foreground/10 text-foreground rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

export function CategoriesManager({
  lines,
  categories,
}: {
  lines: BusinessLine[]
  categories: ProductCategory[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  // Alta
  const [name, setName] = useState('')
  const [lineId, setLineId] = useState(lines[0]?.id ?? '')
  const [sizes, setSizes] = useState('')

  // Edición
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eName, setEName] = useState('')
  const [eLineId, setELineId] = useState('')
  const [eSizes, setESizes] = useState('')
  const [eActive, setEActive] = useState(true)

  async function onAdd() {
    if (!name.trim()) return
    const size_options = parseSizeOptions(sizes)
    if (size_options.length === 0) { toast.error('Cargá al menos un talle'); return }
    setBusy(true)
    const { error } = await addCategory({ name, line_id: lineId || null, size_options })
    setBusy(false)
    if (error) { toast.error(error); return }
    setName(''); setSizes('')
    toast.success('Categoría agregada')
    router.refresh()
  }

  function startEdit(c: ProductCategory) {
    setEditingId(c.id)
    setEName(c.name)
    setELineId(c.line_id ?? '')
    setESizes(joinSizeOptions(c.size_options))
    setEActive(c.active)
  }

  async function onSave(id: string) {
    const size_options = parseSizeOptions(eSizes)
    if (size_options.length === 0) { toast.error('Cargá al menos un talle'); return }
    setBusy(true)
    const { error } = await updateCategory(id, { name: eName, line_id: eLineId || null, size_options, active: eActive })
    setBusy(false)
    if (error) { toast.error(error); return }
    setEditingId(null)
    toast.success('Categoría actualizada')
    router.refresh()
  }

  async function onDelete(id: string) {
    setBusy(true)
    const { error } = await deleteCategory(id)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Categoría borrada')
    router.refresh()
  }

  const lineName = (id: string | null) => lines.find(l => l.id === id)?.name ?? '—'

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Categorías</h2>
        <p className="text-xs text-foreground/50 mt-0.5">Cada categoría define sus talles y sus atributos propios.</p>
      </div>

      {/* Alta */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-foreground/[0.08] bg-background/40 p-3">
        <div className="space-y-1">
          <span className="font-mono text-[10px] text-foreground/50 uppercase tracking-[0.14em]">Nombre</span>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="Camperas" className="h-8 w-40" />
        </div>
        <div className="space-y-1">
          <span className="font-mono text-[10px] text-foreground/50 uppercase tracking-[0.14em]">Rubro</span>
          <select value={lineId} onChange={e => setLineId(e.target.value)} className={`${sel} block`}>
            <option value="">—</option>
            {lines.map(l => <option key={l.id} value={l.id} className="bg-card">{l.name}</option>)}
          </select>
        </div>
        <div className="space-y-1 flex-1 min-w-48">
          <span className="font-mono text-[10px] text-foreground/50 uppercase tracking-[0.14em]">Talles (separados por coma)</span>
          <Input value={sizes} onChange={e => setSizes(e.target.value)} placeholder="S, M, L, XL, XXL" className="h-8" />
        </div>
        <Button onClick={onAdd} disabled={busy || !name.trim()} className="h-8">Agregar</Button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {categories.map(c => (
          <div key={c.id} className="rounded-lg border border-foreground/[0.08] bg-background/30 p-4 space-y-3">
            {editingId === c.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <Input value={eName} onChange={e => setEName(e.target.value)} className="h-8 w-36" />
                <select value={eLineId} onChange={e => setELineId(e.target.value)} className={sel}>
                  <option value="">—</option>
                  {lines.map(l => <option key={l.id} value={l.id} className="bg-card">{l.name}</option>)}
                </select>
                <Input value={eSizes} onChange={e => setESizes(e.target.value)} className="h-8 flex-1 min-w-48" placeholder="Talles" />
                <label className="flex items-center gap-1.5 text-xs text-foreground/70 cursor-pointer">
                  <input type="checkbox" checked={eActive} onChange={e => setEActive(e.target.checked)} className="rounded" /> Activa
                </label>
                <button type="button" onClick={() => onSave(c.id)} disabled={busy} className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Guardar"><Check size={15} /></button>
                <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-md text-foreground/45 hover:bg-foreground/[0.06] transition-colors" title="Cancelar"><X size={15} /></button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                  <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] border border-foreground/10 text-foreground/60">{lineName(c.line_id)}</span>
                  <span className="text-xs text-foreground/45">{joinSizeOptions(c.size_options)}</span>
                  {!c.active && <span className="text-[11px] text-amber-500">inactiva</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => startEdit(c)} className="p-1.5 rounded-md text-foreground/45 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Editar"><Pencil size={14} /></button>
                  <button type="button" onClick={() => onDelete(c.id)} disabled={busy} className="p-1.5 rounded-md text-foreground/45 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Borrar"><Trash2 size={14} /></button>
                </div>
              </div>
            )}

            <CategoryAttributesPanel categoryId={c.id} attributes={c.attributes ?? []} />
          </div>
        ))}
        {categories.length === 0 && <p className="py-2 text-sm text-foreground/45">No hay categorías todavía.</p>}
      </div>
    </div>
  )
}
