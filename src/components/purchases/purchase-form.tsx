'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPurchase, updatePurchase } from '@/app/actions/purchases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import { type VariantOption } from '@/components/sales/sale-form'
import type { Supplier, PaymentStatus, DeliveryStatus } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

interface PurchaseItem {
  variant: VariantOption
  quantity: number
  unit_cost: number
}

export interface PurchaseForEdit {
  id: string
  delivery_status: DeliveryStatus
  supplier_id: string
  purchase_date: string
  payment_status: PaymentStatus
  payment_due_date: string | null
  notes: string | null
  items: { variant_id: string; quantity: number; unit_cost: number }[]
  /** Ítems cuyo producto se borró del catálogo. Se conservan sin cambios al guardar. */
  orphan: { count: number; total: number }
}

export function PurchaseForm({
  variants,
  suppliers,
  purchase,
}: {
  variants: VariantOption[]
  suppliers: Supplier[]
  purchase?: PurchaseForEdit
}) {
  const isEdit = !!purchase
  const router = useRouter()
  const [supplierId, setSupplierId] = useState(purchase?.supplier_id ?? '')
  const [purchaseDate, setPurchaseDate] = useState(purchase?.purchase_date ?? formatDateForInput())
  const [paymentStatus, setPaymentStatus] = useState<string>(purchase?.payment_status ?? 'pendiente')
  // En edición el estado de entrega no se cambia: se usa "Marcar recibida".
  const [deliveryStatus, setDeliveryStatus] = useState<'pedido' | 'recibido'>(
    purchase?.delivery_status ?? 'recibido'
  )
  const [paymentDueDate, setPaymentDueDate] = useState(purchase?.payment_due_date ?? '')
  const [notes, setNotes] = useState(purchase?.notes ?? '')
  const [items, setItems] = useState<PurchaseItem[]>(() => {
    if (!purchase) return []
    const byId = new Map(variants.map(v => [v.id, v]))
    return purchase.items.flatMap(i => {
      const variant = byId.get(i.variant_id)
      return variant ? [{ variant, quantity: i.quantity, unit_cost: i.unit_cost }] : []
    })
  })
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filteredVariants = variants.filter(v =>
    `${v.brand} ${v.model} ${v.color} ${v.size}`.toLowerCase().includes(search.toLowerCase())
  )

  function addItem(variant: VariantOption) {
    if (items.find(i => i.variant.id === variant.id)) return
    setItems([...items, { variant, quantity: 1, unit_cost: variant.cost_price }])
    setSearch('')
  }

  const itemsTotal = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
  const total = itemsTotal + (purchase?.orphan.total ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('Seleccioná un proveedor'); return }
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setLoading(true)
    setError(null)

    const payload = {
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      payment_status: paymentStatus as 'pagado' | 'pendiente' | 'parcial',
      payment_due_date: paymentDueDate || null,
      notes: notes || null,
      items: items.map(i => ({
        variant_id: i.variant.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    }

    if (isEdit) {
      const { error: updError, movedStock } = await updatePurchase(purchase.id, payload)
      if (updError) { setError(updError); setLoading(false); return }
      toast.success(movedStock ? 'Compra actualizada — stock ajustado' : 'Compra actualizada')
      router.push('/compras')
      router.refresh()
      return
    }

    const { error: pErr } = await createPurchase({ ...payload, delivery_status: deliveryStatus })

    if (pErr) { setError(pErr); setLoading(false); return }

    toast.success('Compra registrada — stock actualizado')
    router.push('/compras')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Proveedor</Label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={sel}>
            <option value="" className="bg-card">Seleccionar proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-card">{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Fecha de compra</Label>
          <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Estado de pago</Label>
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className={sel}>
            <option value="pendiente" className="bg-card">Pendiente</option>
            <option value="pagado" className="bg-card">Pagado</option>
            <option value="parcial" className="bg-card">Parcial</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Vencimiento pago</Label>
          <Input type="date" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)} />
        </div>
        {!isEdit && (
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Entrega</Label>
            <select value={deliveryStatus} onChange={e => setDeliveryStatus(e.target.value as 'pedido' | 'recibido')} className={sel}>
              <option value="recibido" className="bg-card">Recibido (suma stock)</option>
              <option value="pedido" className="bg-card">Pedido (no suma stock)</option>
            </select>
          </div>
        )}
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Notas</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas de la compra..." />
        </div>
        {purchase && purchase.orphan.count > 0 && (
          <p className="sm:col-span-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Esta compra incluye {purchase.orphan.count} producto{purchase.orphan.count > 1 ? 's' : ''} que ya no está{purchase.orphan.count > 1 ? 'n' : ''} en el catálogo,
            por {formatCurrency(purchase.orphan.total)}. Se conserva{purchase.orphan.count > 1 ? 'n' : ''} sin cambios y suma{purchase.orphan.count > 1 ? 'n' : ''} al total.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Buscar producto</Label>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nike Air Force 1..." />
        {search && (
          <div className="rounded-xl border border-foreground/10 bg-card divide-y divide-foreground/[0.06] max-h-44 overflow-y-auto shadow-xl">
            {filteredVariants.slice(0, 8).map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => addItem(v)}
                className="w-full text-left px-4 py-2.5 hover:bg-foreground/[0.03] text-sm flex justify-between transition-colors"
              >
                <span className="text-foreground">{v.brand} {v.model} <span className="text-foreground/60">— {v.color} T{v.size}</span></span>
                <span className="text-foreground/55 text-xs">Costo: {formatCurrency(v.cost_price)}</span>
              </button>
            ))}
            {filteredVariants.length === 0 && (
              <p className="px-4 py-3 text-sm text-foreground/45">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-background">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Producto</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Cant.</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Costo unit.</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Subtotal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.variant.id} className="border-b border-foreground/[0.06]">
                  <td className="px-4 py-3 text-foreground">
                    {item.variant.brand} {item.variant.model} T{item.variant.size}
                    <span className="text-foreground/55 text-xs ml-1">({item.variant.color})</span>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      className="w-16"
                      onChange={e =>
                        setItems(items.map(i =>
                          i.variant.id === item.variant.id ? { ...i, quantity: Math.max(1, Number(e.target.value)) } : i
                        ))
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unit_cost}
                      className="w-28"
                      onChange={e =>
                        setItems(items.map(i =>
                          i.variant.id === item.variant.id ? { ...i, unit_cost: Number(e.target.value) } : i
                        ))
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-foreground font-medium">{formatCurrency(item.unit_cost * item.quantity)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setItems(items.filter(i => i.variant.id !== item.variant.id))}
                      className="text-foreground/45 hover:text-red-600 dark:hover:text-red-400 text-xs transition-colors"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-foreground/10 bg-background">
                <td colSpan={3} className="px-4 py-3 text-right text-foreground/60 font-medium">Total:</td>
                <td className="px-4 py-3 font-mono font-semibold text-foreground text-lg tabular-nums">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {error && <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading
          ? 'Guardando...'
          : isEdit
            ? `Guardar cambios — ${formatCurrency(total)}`
            : 'Registrar compra'}
      </Button>
    </form>
  )
}
