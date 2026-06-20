import { createClient } from '@/lib/supabase/server'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { formatCurrency, formatDate } from '@/lib/utils/format'

export default async function EgresosPage() {
  const supabase = await createClient()
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Egresos</h1>
          <p className="text-gray-500 text-sm">Total registrado: {formatCurrency(total)}</p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}>
            + Nuevo egreso
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Registrar egreso</DialogTitle>
            </DialogHeader>
            <ExpenseForm />
          </DialogContent>
        </Dialog>
      </div>
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left p-3">Fecha</th>
              <th className="text-left p-3">Categoría</th>
              <th className="text-left p-3">Descripción</th>
              <th className="text-left p-3">Tipo</th>
              <th className="text-left p-3">Monto</th>
              <th className="text-left p-3">Rec.</th>
            </tr>
          </thead>
          <tbody>
            {expenses?.map(e => (
              <tr key={e.id} className="border-b hover:bg-gray-50">
                <td className="p-3">{formatDate(e.expense_date)}</td>
                <td className="p-3 capitalize">{e.category}</td>
                <td className="p-3 text-gray-600">{e.description ?? '-'}</td>
                <td className="p-3">
                  <Badge variant="outline">{e.type}</Badge>
                </td>
                <td className="p-3 font-medium">{formatCurrency(e.amount)}</td>
                <td className="p-3">{e.recurring ? '✓' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!expenses?.length && (
          <p className="p-6 text-center text-gray-500 text-sm">No hay egresos registrados aún.</p>
        )}
      </div>
    </div>
  )
}
