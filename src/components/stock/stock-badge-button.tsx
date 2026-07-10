'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { AdjustmentForm } from './adjustment-form'

function badgeClass(qty: number) {
  if (qty === 0) return 'bg-transparent border-foreground/10 text-foreground/35 line-through'
  if (qty === 1) return 'bg-amber-500/15 border-amber-500/25 text-amber-600 dark:text-amber-400'
  return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
}

interface StockBadgeButtonProps {
  variantId: string | null
  productId: string
  productName: string
  size: string
  qty: number
}

export function StockBadgeButton({ variantId, productId, productName, size, qty }: StockBadgeButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            title={`Ajustar stock · T${size}`}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border text-xs font-bold cursor-pointer transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 ${badgeClass(qty)}`}
          />
        }
      >
        {qty}
      </DialogTrigger>
      <DialogContent className="max-w-sm bg-card border-foreground/10">
        <DialogHeader>
          <DialogTitle className="text-foreground">Ajustar stock · T{size}</DialogTitle>
        </DialogHeader>
        <AdjustmentForm
          variantId={variantId}
          productId={productId}
          size={size}
          productName={`${productName} · T${size}`}
          currentStock={qty}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
