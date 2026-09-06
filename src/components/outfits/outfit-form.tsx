'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star } from 'lucide-react'
import { createOutfit, updateOutfit, setOutfitProducts } from '@/app/actions/outfits'
import { OutfitProductPicker, type PickerProduct } from './outfit-product-picker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Outfit } from '@/types/database'

const lbl = 'font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]'

export function OutfitForm({
  products,
  outfit,
  initialProductIds = [],
  onSuccess,
}: {
  products: PickerProduct[]
  outfit?: Outfit
  initialProductIds?: string[]
  onSuccess?: () => void
}) {
  const router = useRouter()
  const editing = !!outfit
  const [name, setName] = useState(outfit?.name ?? '')
  const [favorite, setFavorite] = useState(outfit?.favorite ?? false)
  const [selected, setSelected] = useState<string[]>(
    editing ? (outfit!.items ?? []).map(i => i.product_id) : initialProductIds
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function toggle(id: string) {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  async function onSubmit() {
    setError(null)
    if (!name.trim()) { setError('Ponele un nombre al outfit'); return }
    if (selected.length < 2) { setError('Elegí al menos 2 productos'); return }
    setBusy(true)

    if (editing) {
      const { error: uErr } = await updateOutfit(outfit!.id, { name, favorite })
      if (uErr) { setBusy(false); setError(uErr); return }
      const { error: pErr } = await setOutfitProducts(outfit!.id, selected)
      if (pErr) { setBusy(false); setError(pErr); return }
      toast.success('Outfit actualizado')
    } else {
      const { error: cErr } = await createOutfit({ name, favorite, productIds: selected })
      if (cErr) { setBusy(false); setError(cErr); return }
      toast.success('Outfit creado')
    }

    setBusy(false)
    router.refresh()
    onSuccess?.()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className={lbl}>Nombre</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Look urbano Puma Palermo" />
      </div>

      <button
        type="button"
        onClick={() => setFavorite(f => !f)}
        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${favorite ? 'text-amber-500' : 'text-foreground/55 hover:text-foreground'}`}
      >
        <Star size={15} className={favorite ? 'fill-amber-500' : ''} />
        {favorite ? 'Favorito' : 'Marcar como favorito'}
      </button>

      <div className="space-y-1.5">
        <Label className={lbl}>Productos del outfit</Label>
        <OutfitProductPicker products={products} selected={selected} onToggle={toggle} />
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button onClick={onSubmit} disabled={busy} className="w-full">
        {busy ? 'Guardando...' : editing ? 'Guardar cambios' : 'Crear outfit'}
      </Button>
    </div>
  )
}
