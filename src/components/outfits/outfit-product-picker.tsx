'use client'

import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'

export interface PickerProduct {
  id: string
  brand: string
  model: string
  color: string
  categoryName?: string | null
}

/** Selector de productos con buscador. El estado de selección lo maneja el padre. */
export function OutfitProductPicker({
  products,
  selected,
  onToggle,
}: {
  products: PickerProduct[]
  selected: string[]
  onToggle: (id: string) => void
}) {
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()
  const selectedSet = new Set(selected)

  const filtered = useMemo(() => {
    if (!query) return products
    return products.filter(p =>
      `${p.brand} ${p.model} ${p.color} ${p.categoryName ?? ''}`.toLowerCase().includes(query)
    )
  }, [products, query])

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Buscar producto por marca, modelo, color o categoría..."
        className="w-full bg-card border border-foreground/10 text-foreground placeholder-foreground/45 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
      />
      <p className="text-[11px] text-foreground/45">{selected.length} seleccionado{selected.length === 1 ? '' : 's'}</p>
      <div className="max-h-64 overflow-y-auto rounded-lg border border-foreground/[0.08] divide-y divide-foreground/[0.05]">
        {filtered.length === 0 && <p className="px-3 py-4 text-sm text-foreground/45">Sin productos.</p>}
        {filtered.map(p => {
          const on = selectedSet.has(p.id)
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onToggle(p.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${on ? 'bg-indigo-500/10' : 'hover:bg-foreground/[0.03]'}`}
            >
              <span className={`flex items-center justify-center w-4 h-4 rounded border shrink-0 ${on ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-foreground/25'}`}>
                {on && <Check size={12} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sm text-foreground/90">{p.brand} {p.model}</span>
                <span className="text-foreground/50 text-xs"> · {p.color}</span>
              </span>
              {p.categoryName && <span className="text-[11px] text-foreground/40 shrink-0">{p.categoryName}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
