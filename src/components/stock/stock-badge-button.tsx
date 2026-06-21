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
  if (qty === 0) return 'bg-red-500/15 border-red-500/25 text-red-400'
  if (qty <= 2) return 'bg-amber-500/15 border-amber-500/25 text-amber-400'
  return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
}

interface StockBadgeButtonProps {
  productId: string
  productName: string
  size: string
  qty: number
}

export function StockBadgeButton({ productId, productName, size, qty }: StockBadgeButtonProps) {
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
      <DialogContent className="max-w-sm bg-[#15161c] border-white/10">
        <DialogHeader>
          <DialogTitle className="text-white">Ajustar stock · T{size}</DialogTitle>
        </DialogHeader>
        <AdjustmentForm
          productId={productId}
          productName={`${productName} · T${size}`}
          currentStock={qty}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
