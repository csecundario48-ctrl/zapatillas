'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createPurchase } from '@/app/actions/purchases'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { PaymentStatus, Product, Supplier } from '@/types/database'

const sel = 'w-full bg-[#131419] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

interface PurchaseItem {
  product: Product
  quantity: number
  unit_cost: number
}

export function PurchaseForm({ products, suppliers }: { products: Product[]; suppliers: Supplier[] }) {
  const router = useRouter()
  const [supplierId, setSupplierId] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(formatDateForInput())
  const [paymentStatus, setPaymentStatus] = useState('pendiente')
  const [paymentDueDate, setPaymentDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<PurchaseItem[]>([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filteredProducts = products.filter(p =>
    `${p.brand} ${p.model} ${p.color} ${p.size}`.toLowerCase().includes(search.toLowerCase())
  )

  function addItem(product: Product) {
    if (items.find(i => i.product.id === product.id)) return
    setItems([...items, { product, quantity: 1, unit_cost: product.cost_price }])
    setSearch('')
  }

  const total = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) { setError('Seleccioná un proveedor'); return }
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setLoading(true)
    setError(null)

    const result = await createPurchase({
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      payment_status: paymentStatus as PaymentStatus,
      payment_due_date: paymentDueDate || '',
      notes: notes || undefined,
      items: items.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    })

    if (result.error) { setError(result.error); setLoading(false); return }

    toast.success('Compra registrada')
    router.push('/compras')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-[#8a8f98] uppercase tracking-[0.14em]">Proveedor</Label>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className={sel}>
            <option value="" className="bg-[#15161c]">Seleccionar proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id} className="bg-[#15161c]">{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-[#8a8f98] uppercase tracking-[0.14em]">Fecha de compra</Label>
          <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-[#8a8f98] uppercase tracking-[0.14em]">Estado de pago</Label>
          <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className={sel}>
            <option value="pendiente" className="bg-[#15161c]">Pendiente</option>
            <option value="pagado" className="bg-[#15161c]">Pagado</option>
            <option value="parcial" className="bg-[#15161c]">Parcial</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-[#8a8f98] uppercase tracking-[0.14em]">Vencimiento pago</Label>
          <Input type="date" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label className="font-mono text-[10px] text-[#8a8f98] uppercase tracking-[0.14em]">Notas</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas de la compra..." />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="font-mono text-[10px] text-[#8a8f98] uppercase tracking-[0.14em]">Buscar producto</Label>
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nike Air Force 1..." />
        {search && (
          <div className="rounded-xl border border-white/10 bg-[#131419] divide-y divide-white/[0.06] max-h-44 overflow-y-auto shadow-xl">
            {filteredProducts.slice(0, 8).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.03] text-sm flex justify-between transition-colors"
              >
                <span className="text-white">{p.brand} {p.model} <span className="text-[#969696]">— {p.color} T{p.size}</span></span>
                <span className="text-[#828282] text-xs">Costo: {formatCurrency(p.cost_price)}</span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="px-4 py-3 text-sm text-[#6e6e6e]">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="rounded-xl border border-white/[0.08] bg-[#15161c] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-[#0a0a0a]">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em]">Producto</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em]">Cant.</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em]">Costo unit.</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-[#5a5e66] uppercase tracking-[0.14em]">Subtotal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.product.id} className="border-b border-white/[0.06]">
                  <td className="px-4 py-3 text-white">{item.product.brand} {item.product.model} T{item.product.size}</td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={1}
                      value={item.quantity}
                      className="w-16"
                      onChange={e =>
                        setItems(items.map(i =>
                          i.product.id === item.product.id ? { ...i, quantity: Math.max(1, Number(e.target.value)) } : i
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
                          i.product.id === item.product.id ? { ...i, unit_cost: Number(e.target.value) } : i
                        ))
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-white font-medium">{formatCurrency(item.unit_cost * item.quantity)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setItems(items.filter(i => i.product.id !== item.product.id))}
                      className="text-[#6e6e6e] hover:text-red-400 text-xs transition-colors"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 bg-[#0a0a0a]">
                <td colSpan={3} className="px-4 py-3 text-right text-[#969696] font-medium">Total:</td>
                <td className="px-4 py-3 font-mono font-semibold text-white text-lg tabular-nums">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Guardando...' : 'Registrar compra'}
      </Button>
    </form>
  )
}
