'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RowMenu } from '@/components/common/row-menu'
import { deleteErrorMessage } from '@/lib/utils/delete-error'
import { createClient } from '@/lib/supabase/client'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExpenseForm } from './expense-form'
import type { Expense } from '@/types/database'

export function ExpenseRowActions({
  expense,
  categories,
}: {
  expense: Expense
  categories: string[]
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)

  async function del() {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) return { error: deleteErrorMessage(error) }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end">
      <RowMenu
        onDelete={del}
        deleteLabel="Eliminar egreso"
        confirmDescription="Se borra el gasto y deja de contarse en Finanzas. No se puede deshacer."
        onEdit={() => setEditing(true)}
        editLabel="Editar egreso"
      />
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="bg-card border-foreground/10 text-foreground max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar egreso</DialogTitle>
          </DialogHeader>
          <ExpenseForm
            categories={categories}
            expense={expense}
            onSuccess={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
