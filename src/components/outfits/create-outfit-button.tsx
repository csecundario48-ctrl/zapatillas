'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { OutfitForm } from './outfit-form'
import type { PickerProduct } from './outfit-product-picker'

/** Botón que abre el editor de outfit con un producto ya preseleccionado. */
export function CreateOutfitButton({
  products,
  initialProductId,
  label = '+ Armar outfit con este',
}: {
  products: PickerProduct[]
  initialProductId: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-8" />}>{label}</DialogTrigger>
      <DialogContent className="max-w-lg bg-card border-foreground/10">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nuevo outfit</DialogTitle>
        </DialogHeader>
        <OutfitForm products={products} initialProductIds={[initialProductId]} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
