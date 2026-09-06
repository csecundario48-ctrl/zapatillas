'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Star, Pencil, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OutfitForm } from '@/components/outfits/outfit-form'
import type { PickerProduct } from '@/components/outfits/outfit-product-picker'
import { toggleFavorite, deleteOutfit } from '@/app/actions/outfits'
import type { Outfit } from '@/types/database'

interface Props {
  outfits: Outfit[]
  products: PickerProduct[]
  isAdmin: boolean
}

function productLabel(p?: { brand: string; model: string; color: string } | null) {
  if (!p) return 'Producto'
  return `${p.brand} ${p.model} · ${p.color}`
}

function OutfitCard({ outfit, products, isAdmin }: { outfit: Outfit; products: PickerProduct[]; isAdmin: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const items = [...(outfit.items ?? [])].sort((a, b) => a.sort_order - b.sort_order)

  async function onToggleFav() {
    setBusy(true)
    const { error } = await toggleFavorite(outfit.id, !outfit.favorite)
    setBusy(false)
    if (error) { toast.error(error); return }
    router.refresh()
  }

  async function onDelete() {
    if (!confirm(`¿Borrar el outfit "${outfit.name}"?`)) return
    setBusy(true)
    const { error } = await deleteOutfit(outfit.id)
    setBusy(false)
    if (error) { toast.error(error); return }
    toast.success('Outfit borrado')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{outfit.name}</h3>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleFav}
            disabled={busy || !isAdmin}
            className={`p-1 rounded-md transition-colors ${outfit.favorite ? 'text-amber-500' : 'text-foreground/35 hover:text-amber-500'} disabled:cursor-default`}
            title={outfit.favorite ? 'Favorito' : 'Marcar favorito'}
          >
            <Star size={15} className={outfit.favorite ? 'fill-amber-500' : ''} />
          </button>
          {isAdmin && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="p-1 rounded-md text-foreground/40 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors" title="Editar"><Pencil size={14} /></button>
              <button type="button" onClick={onDelete} disabled={busy} className="p-1 rounded-md text-foreground/40 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="Borrar"><Trash2 size={14} /></button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && <span className="text-xs text-foreground/40">Sin productos</span>}
        {items.map(it => (
          <Link
            key={it.id}
            href={`/catalogo/${it.product_id}`}
            className="inline-flex items-center rounded-md border border-foreground/[0.08] bg-background/60 px-2 py-1 text-xs text-foreground/80 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors"
          >
            {productLabel(it.product)}
          </Link>
        ))}
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-lg bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar outfit</DialogTitle>
          </DialogHeader>
          <OutfitForm products={products} outfit={outfit} onSuccess={() => setEditing(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function OutfitsClient({ outfits, products, isAdmin }: Props) {
  const [onlyFav, setOnlyFav] = useState(false)
  const [open, setOpen] = useState(false)

  const filtered = onlyFav ? outfits.filter(o => o.favorite) : outfits

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Outfits</h1>
          <p className="text-foreground/55 text-sm mt-0.5">{filtered.length} de {outfits.length} outfits</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setOnlyFav(v => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${onlyFav ? 'border-amber-500/40 text-amber-500 bg-amber-500/5' : 'border-foreground/10 text-foreground/60 hover:text-foreground'}`}
          >
            <Star size={14} className={onlyFav ? 'fill-amber-500' : ''} /> Favoritos
          </button>
          {isAdmin && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button />}>+ Nuevo outfit</DialogTrigger>
              <DialogContent className="max-w-lg bg-card border-foreground/10">
                <DialogHeader>
                  <DialogTitle className="text-foreground">Nuevo outfit</DialogTitle>
                </DialogHeader>
                <OutfitForm products={products} onSuccess={() => setOpen(false)} />
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">
            {onlyFav ? 'No hay outfits favoritos todavía.' : 'No hay outfits creados aún.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(o => (
            <OutfitCard key={o.id} outfit={o} products={products} isAdmin={isAdmin} />
          ))}
        </div>
      )}
    </div>
  )
}
