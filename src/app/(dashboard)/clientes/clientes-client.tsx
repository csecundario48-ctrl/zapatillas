'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CustomerForm } from '@/components/customers/customer-form'
import { WhatsAppButton } from '@/components/contact/whatsapp-button'
import { RowMenu } from '@/components/common/row-menu'
import { deleteErrorMessage } from '@/lib/utils/delete-error'
import { ExportCsvButton } from '@/components/common/export-csv-button'
import { CustomerHistoryButton } from '@/components/customers/customer-history'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import type { Customer } from '@/types/database'

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  instagram: string | null
  address: string | null
  purchases: number
  totalSpent: number
  lastPurchase: string | null
  daysSince: number | null
  badges: ('vip' | 'frecuente' | 'inactivo' | 'nuevo')[]
}

function CustomerRowActions({ row }: { row: CustomerRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const customer = {
    id: row.id, name: row.name, phone: row.phone, email: row.email,
    instagram: row.instagram, address: row.address,
  } as Customer

  async function del() {
    const supabase = createClient()
    const { error } = await supabase.from('customers').delete().eq('id', row.id)
    if (error) return { error: deleteErrorMessage(error) }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end">
      <RowMenu
        onDelete={del}
        deleteLabel="Eliminar cliente"
        onEdit={() => setOpen(true)}
        editLabel="Editar cliente"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar cliente</DialogTitle>
          </DialogHeader>
          <CustomerForm customer={customer} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

const badgeStyle: Record<CustomerRow['badges'][number], { label: string; cls: string }> = {
  vip:       { label: 'VIP',       cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  frecuente: { label: 'Frecuente', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  inactivo:  { label: 'Inactivo',  cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  nuevo:     { label: 'Nuevo',     cls: 'bg-foreground/[0.04] text-foreground/60 border-foreground/10' },
}

function lastLabel(row: CustomerRow) {
  if (row.daysSince === null) return '—'
  if (row.daysSince === 0) return 'Hoy'
  if (row.daysSince === 1) return 'Ayer'
  if (row.daysSince < 30) return `Hace ${row.daysSince} días`
  const months = Math.floor(row.daysSince / 30)
  return `Hace ${months} mes${months > 1 ? 'es' : ''}`
}

export function ClientesClient({ rows }: { rows: CustomerRow[] }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = search
    ? rows.filter(r =>
        `${r.name} ${r.phone ?? ''} ${r.email ?? ''} ${r.instagram ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : rows

  const vipCount = rows.filter(r => r.badges.includes('vip')).length
  const inactiveCount = rows.filter(r => r.badges.includes('inactivo')).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Clientes</h1>
          <p className="text-foreground/55 text-sm mt-0.5">
            {rows.length} clientes · {vipCount} VIP · {inactiveCount} inactivos
          </p>
        </div>
        <div className="flex gap-3">
          <ExportCsvButton
            filename="clientes.csv"
            headers={['Nombre', 'Teléfono', 'Email', 'Instagram', 'Compras', 'Total gastado', 'Última compra']}
            rows={rows.map(r => [
              r.name, r.phone, r.email, r.instagram,
              r.purchases, r.totalSpent, r.lastPurchase,
            ])}
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, tel, email..."
            className="w-64 bg-card border border-foreground/10 text-foreground placeholder-foreground/45 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>+ Nuevo cliente</DialogTrigger>
            <DialogContent className="max-w-lg bg-card border-foreground/10">
              <DialogHeader>
                <DialogTitle className="text-foreground">Agregar cliente</DialogTitle>
              </DialogHeader>
              <CustomerForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">
            {search ? `Sin resultados para "${search}"` : 'No hay clientes cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-card">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Contacto</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Compras</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Gasto total</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Última</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-foreground/[0.05] hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{r.name}</span>
                        {r.badges.map(b => (
                          <span key={b} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeStyle[b].cls}`}>
                            {badgeStyle[b].label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      <div className="flex flex-col gap-0.5">
                        {r.instagram && (
                          <a
                            href={`https://instagram.com/${r.instagram.replace('@', '')}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-[12px] text-violet-400 hover:text-violet-300 transition-colors"
                          >
                            {r.instagram.startsWith('@') ? r.instagram : `@${r.instagram}`}
                          </a>
                        )}
                        {r.email && <span className="text-[12px] text-foreground/55">{r.email}</span>}
                        {!r.instagram && !r.email && <span className="text-[12px] text-foreground/40">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/85 font-mono">{r.purchases}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium text-foreground tabular-nums">{formatCurrency(r.totalSpent)}</td>
                    <td className="px-4 py-3 text-foreground/55">{lastLabel(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <CustomerHistoryButton customerId={r.id} customerName={r.name} />
                        <WhatsAppButton phone={r.phone} name={r.name} withTemplates />
                        <CustomerRowActions row={r} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
