'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProductForm } from './product-form'
import { RowMenu } from '@/components/common/row-menu'
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
    <div className="flex items-center justify-end">
      <RowMenu
        onDelete={del}
        deleteLabel="Eliminar producto"
        onEdit={() => setOpen(true)}
        editLabel="Editar producto"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar producto</DialogTitle>
          </DialogHeader>
          <ProductForm suppliers={suppliers} product={product} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
