'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ProductForm } from './product-form'
import { ConfirmDelete } from '@/components/common/confirm-delete'
import { deleteProduct } from '@/app/actions/products'
import type { Product, Supplier } from '@/types/database'

interface Props {
  product: Product
  suppliers: Pick<Supplier, 'id' | 'name'>[]
}

export function ProductRowActions({ product, suppliers }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function del() {
    const { error } = await deleteProduct(product.id)
    if (error) return { error }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <button
              type="button"
              title="Editar"
              className="p-1.5 rounded-md text-foreground/45 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            />
          }
        >
          <Pencil size={14} />
        </DialogTrigger>
        <DialogContent className="max-w-2xl bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar producto</DialogTitle>
          </DialogHeader>
          <ProductForm suppliers={suppliers} product={product} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <ConfirmDelete onConfirm={del} title="Eliminar producto" />
    </div>
  )
}
