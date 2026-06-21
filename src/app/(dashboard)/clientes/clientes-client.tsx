'use client'

import { useState } from 'react'
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
import { formatCurrency } from '@/lib/utils/format'

export interface CustomerRow {
  id: string
  name: string
  phone: string | null
  email: string | null
  instagram: string | null
  purchases: number
  totalSpent: number
  lastPurchase: string | null
  daysSince: number | null
  badges: ('vip' | 'frecuente' | 'inactivo' | 'nuevo')[]
}

const badgeStyle: Record<CustomerRow['badges'][number], { label: string; cls: string }> = {
  vip:       { label: 'VIP',       cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  frecuente: { label: 'Frecuente', cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
  inactivo:  { label: 'Inactivo',  cls: 'bg-red-500/10 text-red-400 border-red-500/20' },
  nuevo:     { label: 'Nuevo',     cls: 'bg-white/[0.04] text-[#969696] border-white/10' },
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
          <h1 className="text-2xl font-semibold tracking-tight text-white">Clientes</h1>
          <p className="text-[#828282] text-sm mt-0.5">
            {rows.length} clientes · {vipCount} VIP · {inactiveCount} inactivos
          </p>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, tel, email..."
            className="w-64 bg-[#131419] border border-white/10 text-white placeholder-[#6e6e6e] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger render={<Button />}>+ Nuevo cliente</DialogTrigger>
            <DialogContent className="max-w-lg bg-[#15161c] border-white/10">
              <DialogHeader>
                <DialogTitle className="text-white">Agregar cliente</DialogTitle>
              </DialogHeader>
              <CustomerForm onSuccess={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.08] bg-[#15161c] py-16 text-center">
          <p className="text-[#6e6e6e] text-sm">
            {search ? `Sin resultados para "${search}"` : 'No hay clientes cargados aún.'}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.08] bg-[#15161c] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#101116]">
                  <th className="text-left px-4 py-3 text-xs text-[#828282] uppercase tracking-wider font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs text-[#828282] uppercase tracking-wider font-medium">Contacto</th>
                  <th className="text-right px-4 py-3 text-xs text-[#828282] uppercase tracking-wider font-medium">Compras</th>
                  <th className="text-right px-4 py-3 text-xs text-[#828282] uppercase tracking-wider font-medium">Gasto total</th>
                  <th className="text-left px-4 py-3 text-xs text-[#828282] uppercase tracking-wider font-medium">Última</th>
                  <th className="text-right px-4 py-3 text-xs text-[#828282] uppercase tracking-wider font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white">{r.name}</span>
                        {r.badges.map(b => (
                          <span key={b} className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${badgeStyle[b].cls}`}>
                            {badgeStyle[b].label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#a8a8a8]">
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
                        {r.email && <span className="text-[12px] text-[#828282]">{r.email}</span>}
                        {!r.instagram && !r.email && <span className="text-[12px] text-[#5c5c5c]">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-[#cfcfcf] font-mono">{r.purchases}</td>
                    <td className="px-4 py-3 text-right font-semibold text-white">{formatCurrency(r.totalSpent)}</td>
                    <td className="px-4 py-3 text-[#828282]">{lastLabel(r)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <WhatsAppButton phone={r.phone} name={r.name} withTemplates />
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
