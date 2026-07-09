import { createClient } from '@/lib/supabase/server'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { argDateStr, formatCurrency, formatDate } from '@/lib/utils/format'

const categoryColors: Record<string, string> = {
  alquiler: 'text-violet-400',
  servicios: 'text-blue-400',
  marketing: 'text-indigo-400',
  delivery: 'text-emerald-400',
  salarios: 'text-amber-400',
  packaging: 'text-orange-400',
  otros: 'text-[#969696]',
}

export default async function EgresosPage() {
  const supabase = await createClient()
  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('expense_date', { ascending: false })

  const total = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0
  const monthStart = `${argDateStr().slice(0, 7)}-01`
  const thisMonth = expenses
    ?.filter(e => e.expense_date >= monthStart)
    .reduce((sum, e) => sum + e.amount, 0) ?? 0

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Egresos</h1>
          <p className="text-sm text-[#828282] mt-0.5">
            Este mes: {formatCurrency(thisMonth)} · Total: {formatCurrency(total)}
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button />}>
            + Nuevo egreso
          </DialogTrigger>
          <DialogContent className="bg-[#15161c] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-white">Registrar egreso</DialogTitle>
            </DialogHeader>
            <ExpenseForm />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-[#15161c] overflow-x-auto">
        {expenses && expenses.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#0a0a0a]">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Fecha</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Categoría</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Descripción</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Monto</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em] font-medium">Rec.</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} className="border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-mono text-[12px] text-[#8a8f98]">{formatDate(e.expense_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`capitalize font-medium ${categoryColors[e.category] ?? 'text-[#dcdcdc]'}`}>
                      {e.category}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#969696]">{e.description ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border ${
                      e.type === 'fijo'
                        ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                        : 'bg-[#1f2026] border-white/10 text-[#969696]'
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-white tabular-nums">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-center">
                    {e.recurring ? (
                      <span className="text-indigo-400 text-xs">✓</span>
                    ) : (
                      <span className="text-[#5c5c5c]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="py-16 text-center">
            <p className="text-[#6e6e6e] text-sm">No hay egresos registrados aún.</p>
          </div>
        )}
      </div>
    </div>
  )
}
