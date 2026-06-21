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
import { ConfirmDelete, deleteErrorMessage } from '@/components/common/confirm-delete'
import { createClient } from '@/lib/supabase/client'
import type { Product, Supplier } from '@/types/database'

interface Props {
  product: Product
  suppliers: Pick<Supplier, 'id' | 'name'>[]
}

export function ProductRowActions({ product, suppliers }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function del() {
    const supabase = createClient()
    const { error } = await supabase.from('products').delete().eq('id', product.id)
    if (error) return { error: deleteErrorMessage(error) }
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
              className="p-1.5 rounded-md text-[#6e6e6e] hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            />
          }
        >
          <Pencil size={14} />
        </DialogTrigger>
        <DialogContent className="max-w-2xl bg-[#15161c] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Editar producto</DialogTitle>
          </DialogHeader>
          <ProductForm suppliers={suppliers} product={product} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
      <ConfirmDelete onConfirm={del} title="Eliminar producto" />
    </div>
  )
}
