'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { Product, Supplier } from '@/types/database'

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
    const supabase = createClient()

    const { data: purchase, error: pErr } = await supabase
      .from('purchases')
      .insert({
        supplier_id: supplierId,
        purchase_date: purchaseDate,
        total_amount: total,
        payment_status: paymentStatus as 'pagado' | 'pendiente' | 'parcial',
        payment_due_date: paymentDueDate || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (pErr) { setError(pErr.message); setLoading(false); return }

    const { error: iErr } = await supabase.from('purchase_items').insert(
      items.map(i => ({
        purchase_id: purchase.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        subtotal: i.unit_cost * i.quantity,
      }))
    )

    if (iErr) { setError(iErr.message); setLoading(false); return }
    router.push('/compras')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label>Proveedor</Label>
          <select
            value={supplierId}
            onChange={e => setSupplierId(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-white"
          >
            <option value="">Seleccionar proveedor</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label>Fecha de compra</Label>
          <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Estado de pago</Label>
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-white"
          >
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="parcial">Parcial</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Fecha vencimiento pago</Label>
          <Input type="date" value={paymentDueDate} onChange={e => setPaymentDueDate(e.target.value)} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Notas (opcional)</Label>
          <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas de la compra" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Buscar producto</Label>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nike Air Force 1..."
        />
        {search && (
          <div className="border rounded-lg divide-y max-h-40 overflow-y-auto bg-white shadow-sm">
            {filteredProducts.slice(0, 8).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between"
              >
                <span>{p.brand} {p.model} — {p.color} T{p.size}</span>
                <span className="text-gray-500 text-xs">Costo: {formatCurrency(p.cost_price)}</span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-500">Sin resultados</p>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <table className="w-full text-sm border rounded-lg overflow-hidden">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-3">Producto</th>
              <th className="text-left p-3">Cant.</th>
              <th className="text-left p-3">Costo unit.</th>
              <th className="text-left p-3">Subtotal</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.product.id} className="border-b">
                <td className="p-3">{item.product.brand} {item.product.model} T{item.product.size}</td>
                <td className="p-3">
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
                <td className="p-3">
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
                <td className="p-3">{formatCurrency(item.unit_cost * item.quantity)}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => setItems(items.filter(i => i.product.id !== item.product.id))}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Quitar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={3} className="p-3 text-right font-bold">Total:</td>
              <td className="p-3 font-bold">{formatCurrency(total)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Guardando...' : 'Registrar compra'}
      </Button>
    </form>
  )
}
