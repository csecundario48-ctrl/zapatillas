'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { Product } from '@/types/database'

const sel = 'w-full bg-[#0f0f0f] border border-[#2a2a2a] text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors'

interface SaleItem {
  product: Product
  quantity: number
  unit_price: number
  discount: number
}

export function SaleForm({ products }: { products: Product[] }) {
  const router = useRouter()
  const [items, setItems] = useState<SaleItem[]>([])
  const [channel, setChannel] = useState('fisica')
  const [paymentMethod, setPaymentMethod] = useState('efectivo')
  const [saleDate, setSaleDate] = useState(formatDateForInput())
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const filteredProducts = products.filter(
    p =>
      p.active &&
      p.stock_quantity > 0 &&
      `${p.brand} ${p.model} ${p.color} ${p.size} ${p.sku}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )

  function addItem(product: Product) {
    const existing = items.find(i => i.product.id === product.id)
    if (existing) {
      if (existing.quantity >= product.stock_quantity) {
        setError(`Stock insuficiente: solo hay ${product.stock_quantity} ud. de ${product.brand} ${product.model} T${product.size}`)
        return
      }
      setItems(items.map(i =>
        i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setItems([...items, { product, quantity: 1, unit_price: product.sale_price, discount: 0 }])
    }
    setSearch('')
    setError(null)
  }

  function removeItem(productId: string) {
    setItems(items.filter(i => i.product.id !== productId))
  }

  const total = items.reduce((sum, i) => sum + (i.unit_price - i.discount) * i.quantity, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    setLoading(true)
    setError(null)
    const supabase = createClient()

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert({
        sale_date: saleDate,
        channel: channel as 'fisica' | 'online',
        payment_method: paymentMethod as 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago',
        total_amount: total,
        status: 'completada',
      })
      .select()
      .single()

    if (saleError) { setError(saleError.message); setLoading(false); return }

    const { error: itemsError } = await supabase.from('sale_items').insert(
      items.map(i => ({
        sale_id: sale.id,
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
        subtotal: (i.unit_price - i.discount) * i.quantity,
      }))
    )

    if (itemsError) { setError(itemsError.message); setLoading(false); return }

    toast.success(`Venta registrada — ${formatCurrency(total)}`)
    router.push('/ventas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Fecha</Label>
          <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Canal</Label>
          <select value={channel} onChange={e => setChannel(e.target.value)} className={sel}>
            <option value="fisica" className="bg-[#111]">Física</option>
            <option value="online" className="bg-[#111]">Online</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#666] uppercase tracking-wider">Medio de pago</Label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={sel}>
            <option value="efectivo" className="bg-[#111]">Efectivo</option>
            <option value="transferencia" className="bg-[#111]">Transferencia</option>
            <option value="tarjeta" className="bg-[#111]">Tarjeta</option>
            <option value="mercadopago" className="bg-[#111]">MercadoPago</option>
          </select>
        </div>
      </div>

      {/* Product search */}
      <div className="space-y-2">
        <Label className="text-xs text-[#666] uppercase tracking-wider">Buscar producto</Label>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nike Air Force 1 Blanco T42..."
        />
        {search && (
          <div className="rounded-xl border border-[#2a2a2a] bg-[#0f0f0f] divide-y divide-[#1a1a1a] max-h-52 overflow-y-auto shadow-xl">
            {filteredProducts.slice(0, 8).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.03] text-sm flex justify-between items-center transition-colors"
              >
                <span className="text-white">
                  {p.brand} {p.model}
                  <span className="text-[#666] ml-1">— {p.color} T{p.size}</span>
                </span>
                <span className="text-[#555] text-xs ml-3 shrink-0">
                  Stock: <span className={p.stock_quantity <= 2 ? 'text-amber-400' : 'text-emerald-400'}>{p.stock_quantity}</span>
                  {' · '}{formatCurrency(p.sale_price)}
                </span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="px-4 py-3 text-sm text-[#444]">Sin resultados con stock disponible</p>
            )}
          </div>
        )}
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="rounded-xl border border-[#1f1f1f] bg-[#111] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1a1a1a] bg-[#0a0a0a]">
                <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">Cant.</th>
                <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">Precio</th>
                <th className="text-left px-4 py-3 text-xs text-[#444] uppercase tracking-wider">Subtotal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.product.id} className="border-b border-[#1a1a1a]">
                  <td className="px-4 py-3 text-white">
                    {item.product.brand} {item.product.model} T{item.product.size}
                    <span className="text-[#555] text-xs ml-1">({item.product.color})</span>
                  </td>
                  <td className="px-4 py-3">
                    <Input
                      type="number"
                      min={1}
                      max={item.product.stock_quantity}
                      value={item.quantity}
                      className="w-16"
                      onChange={e =>
                        setItems(items.map(i =>
                          i.product.id === item.product.id
                            ? { ...i, quantity: Math.min(Math.max(1, Number(e.target.value)), item.product.stock_quantity) }
                            : i
                        ))
                      }
                    />
                  </td>
                  <td className="px-4 py-3 text-[#888]">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 font-semibold text-white">
                    {formatCurrency((item.unit_price - item.discount) * item.quantity)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      className="text-[#444] hover:text-red-400 text-xs transition-colors"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#2a2a2a] bg-[#0a0a0a]">
                <td colSpan={3} className="px-4 py-3 text-right text-[#666] font-medium">Total:</td>
                <td className="px-4 py-3 font-bold text-xl text-white">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button
        type="submit"
        disabled={loading || items.length === 0}
        className="w-full py-3"
      >
        {loading ? 'Registrando venta...' : `Confirmar venta — ${formatCurrency(total)}`}
      </Button>
    </form>
  )
}
