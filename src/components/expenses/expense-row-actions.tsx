'use client'

import { useRouter } from 'next/navigation'
import { RowMenu } from '@/components/common/row-menu'
import { deleteErrorMessage } from '@/components/common/confirm-delete'
import { createClient } from '@/lib/supabase/client'

export function ExpenseRowActions({ expenseId }: { expenseId: string }) {
  const router = useRouter()

  async function del() {
    const supabase = createClient()
    const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
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
      />
    </div>
  )
}
