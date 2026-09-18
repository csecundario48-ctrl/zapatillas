'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { SupplierForm } from '@/components/suppliers/supplier-form'
import { WhatsAppButton } from '@/components/contact/whatsapp-button'
import { RowMenu } from '@/components/common/row-menu'
import { deleteErrorMessage } from '@/lib/utils/delete-error'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/format'
import type { Supplier } from '@/types/database'

export interface SupplierRow {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  purchases: number
  totalBought: number
  debt: number
  lastPurchase: string | null
  daysSince: number | null
}

function SupplierRowActions({ row }: { row: SupplierRow }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const supplier = {
    id: row.id, name: row.name, contact_name: row.contactName, phone: row.phone,
    email: row.email, address: row.address, notes: row.notes,
  } as Supplier

  async function del() {
    const supabase = createClient()
    const { error } = await supabase.from('suppliers').delete().eq('id', row.id)
    if (error) return { error: deleteErrorMessage(error) }
    router.refresh()
    return {}
  }

  return (
    <div className="flex items-center justify-end">
      <RowMenu
        onDelete={del}
        deleteLabel="Eliminar proveedor"
        onEdit={() => setOpen(true)}
        editLabel="Editar proveedor"
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-foreground/10">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar proveedor</DialogTitle>
          </DialogHeader>
          <SupplierForm supplier={supplier} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function lastLabel(days: number | null) {
  if (days === null) return '—'
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 30) return `Hace ${days} días`
  const months = Math.floor(days / 30)
  return `Hace ${months} mes${months > 1 ? 'es' : ''}`
}

export function ProveedoresClient({ rows }: { rows: SupplierRow[] }) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = search
    ? rows.filter(r =>
        `${r.name} ${r.contactName ?? ''} ${r.phone ?? ''} ${r.email ?? ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : rows

  const totalDebt = rows.reduce((s, r) => s + r.debt, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Proveedores</h1>
          <p className="text-foreground/55 text-sm mt-0.5">
            {rows.length} proveedores
            {totalDebt > 0 && <span className="text-red-600 dark:text-red-400"> · {formatCurrency(totalDebt)} en deuda</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar proveedor..."
            className="w-64 bg-card border border-foreground/10 text-foreground placeholder-foreground/45 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>+ Nuevo proveedor</DialogTrigger>
            <DialogContent className="max-w-lg bg-card border-foreground/10">
              <DialogHeader>
                <DialogTitle className="text-foreground">Agregar proveedor</DialogTitle>
              </DialogHeader>
              <SupplierForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-foreground/[0.08] bg-card py-16 text-center">
          <p className="text-foreground/45 text-sm">
            {search ? `Sin resultados para "${search}"` : 'No hay proveedores cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-foreground/[0.06] bg-card">
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Proveedor</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Contacto</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Compras</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Deuda</th>
                  <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Último pedido</th>
                  <th className="text-right px-4 py-3 font-mono text-[10px] text-foreground/55 uppercase tracking-[0.14em] font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-foreground/[0.05] hover:bg-foreground/[0.02] transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <Link href={`/proveedores/${r.id}`} className="text-foreground hover:text-indigo-400 transition-colors">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-foreground/70">
                      <div className="flex flex-col gap-0.5">
                        {r.contactName && <span className="text-[12px] text-foreground/85">{r.contactName}</span>}
                        {r.email && <span className="text-[12px] text-foreground/55">{r.email}</span>}
                        {!r.contactName && !r.email && <span className="text-[12px] text-foreground/40">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-foreground/85 font-mono">{r.purchases}</td>
                    <td className="px-4 py-3 text-right font-mono text-foreground/85 tabular-nums">{formatCurrency(r.totalBought)}</td>
                    <td className="px-4 py-3 text-right font-mono font-medium tabular-nums">
                      {r.debt > 0
                        ? <span className="text-red-600 dark:text-red-400">{formatCurrency(r.debt)}</span>
                        : <span className="text-emerald-600 dark:text-emerald-400">$0</span>}
                    </td>
                    <td className="px-4 py-3 text-foreground/55">{lastLabel(r.daysSince)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <WhatsAppButton phone={r.phone} name={r.contactName ?? r.name} />
                        <SupplierRowActions row={r} />
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
