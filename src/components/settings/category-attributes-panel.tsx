'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
import { addAttribute, deleteAttribute } from '@/app/actions/catalog'
import { parseSizeOptions } from '@/lib/catalog/sizes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AttributeType, CategoryAttribute } from '@/types/database'

const sel = 'bg-card border border-foreground/10 text-foreground rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

const TYPE_LABEL: Record<AttributeType, string> = { text: 'Texto', number: 'Número', select: 'Opciones' }

export function CategoryAttributesPanel({
  categoryId,
  attributes,
}: {
  categoryId: string
  attributes: CategoryAttribute[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [type, setType] = useState<AttributeType>('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)
  const [filterable, setFilterable] = useState(true)

  async function onAdd() {
    if (!label.trim()) return
    setBusy(true)
    const { error } = await addAttribute({
      category_id: categoryId,
      label,
      type,
      options: type === 'select' ? parseSizeOptions(options) : [],
      required,
      filterable,
    })
    setBusy(false)
    if (error) { toast.error(error); return }
    setLabel(''); setType('text'); setOptions(''); setRequired(false); setFilterable(true); setAdding(false)
    toast.success('Atributo agregado')
    router.refresh()
  }

  async function onDelete(id: string) {
    setBusy(true)
    const { error } = await deleteAttribute(id)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Atributo borrado')
    router.refresh()
  }

  return (
    <div className="space-y-2 pt-2 border-t border-foreground/[0.06]">
      <span className="font-mono text-[10px] text-foreground/50 uppercase tracking-[0.14em]">Atributos propios</span>

      <div className="flex flex-wrap gap-1.5">
        {attributes.map(a => (
          <span key={a.id} className="inline-flex items-center gap-1.5 rounded-md border border-foreground/[0.08] bg-background/60 pl-2 pr-1 py-1 text-xs text-foreground/80">
            <span className="font-medium">{a.label}</span>
            <span className="text-foreground/40">{TYPE_LABEL[a.type]}{a.type === 'select' && a.options.length ? `: ${a.options.join('/')}` : ''}</span>
            {a.required && <span className="text-amber-500" title="Requerido">•req</span>}
            {a.filterable && <span className="text-indigo-400" title="Filtrable">•filtro</span>}
            <button type="button" onClick={() => onDelete(a.id)} disabled={busy} className="p-0.5 rounded text-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Borrar atributo"><Trash2 size={12} /></button>
          </span>
        ))}
        {attributes.length === 0 && !adding && <span className="text-xs text-foreground/40">Sin atributos propios.</span>}
      </div>

      {adding ? (
        <div className="space-y-2 rounded-lg border border-foreground/[0.08] bg-background/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nombre (ej. Material)" className="h-8 w-40" />
            <select value={type} onChange={e => setType(e.target.value as AttributeType)} className={sel}>
              <option value="text">Texto</option>
              <option value="number">Número</option>
              <option value="select">Opciones</option>
            </select>
            {type === 'select' && (
              <Input value={options} onChange={e => setOptions(e.target.value)} placeholder="Opciones: Cargo, Baggy, Wide" className="h-8 w-56" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-foreground/70 cursor-pointer">
              <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} className="rounded" /> Requerido
            </label>
            <label className="flex items-center gap-1.5 text-xs text-foreground/70 cursor-pointer">
              <input type="checkbox" checked={filterable} onChange={e => setFilterable(e.target.checked)} className="rounded" /> Usar como filtro
            </label>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setAdding(false)} className="text-xs text-foreground/55 hover:text-foreground px-2 py-1">Cancelar</button>
              <Button onClick={onAdd} disabled={busy || !label.trim()} className="h-8">Agregar</Button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-400 transition-colors">
          <Plus size={13} /> Agregar atributo
        </button>
      )}
    </div>
  )
}
