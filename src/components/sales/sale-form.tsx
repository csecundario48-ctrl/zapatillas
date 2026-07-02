'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSale } from '@/app/actions/sales'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { Product, Customer } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

interface SaleItem {
  product: Product
  quantity: number
  unit_price: number
  discount: number
}

export function SaleForm({ products, customers }: { products: Product[]; customers: Customer[] }) {
  const router = useRouter()
  const [items, setItems] = useState<SaleItem[]>([])
  const [customerId, setCustomerId] = useState('')
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

    const { error: saleError } = await createSale({
      sale_date: saleDate,
      channel: channel as 'fisica' | 'online',
      payment_method: paymentMethod as 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago',
      customer_id: customerId || null,
      items: items.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
    })

    if (saleError) { setError(saleError); setLoading(false); return }

    toast.success(`Venta registrada — ${formatCurrency(total)}`)
    router.push('/ventas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-foreground/60 uppercase tracking-wider">Cliente <span className="text-foreground/40 normal-case tracking-normal">(opcional)</span></Label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className={sel}>
            <option value="" className="bg-card">Sin cliente / mostrador</option>
            {customers.map(c => (
              <option key={c.id} value={c.id} className="bg-card">{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-foreground/60 uppercase tracking-wider">Fecha</Label>
          <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-foreground/60 uppercase tracking-wider">Canal</Label>
          <select value={channel} onChange={e => setChannel(e.target.value)} className={sel}>
            <option value="fisica" className="bg-card">Física</option>
            <option value="online" className="bg-card">Online</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-foreground/60 uppercase tracking-wider">Medio de pago</Label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={sel}>
            <option value="efectivo" className="bg-card">Efectivo</option>
            <option value="transferencia" className="bg-card">Transferencia</option>
            <option value="tarjeta" className="bg-card">Tarjeta</option>
            <option value="mercadopago" className="bg-card">MercadoPago</option>
          </select>
        </div>
      </div>

      {/* Product search */}
      <div className="space-y-2">
        <Label className="text-xs text-foreground/60 uppercase tracking-wider">Buscar producto</Label>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nike Air Force 1 Blanco T42..."
        />
        {search && (
          <div className="rounded-xl border border-foreground/10 bg-card divide-y divide-foreground/[0.06] max-h-52 overflow-y-auto shadow-xl">
            {filteredProducts.slice(0, 8).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-foreground/[0.03] text-sm flex justify-between items-center transition-colors"
              >
                <span className="text-foreground">
                  {p.brand} {p.model}
                  <span className="text-foreground/60 ml-1">— {p.color} T{p.size}</span>
                </span>
                <span className="text-foreground/55 text-xs ml-3 shrink-0">
                  Stock: <span className={p.stock_quantity <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{p.stock_quantity}</span>
                  {' · '}{formatCurrency(p.sale_price)}
                </span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="px-4 py-3 text-sm text-foreground/45">Sin resultados con stock disponible</p>
            )}
          </div>
        )}
      </div>

      {/* Items table */}
      {items.length > 0 && (
        <div className="rounded-xl border border-foreground/[0.08] bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/[0.06] bg-background">
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider">Producto</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider">Cant.</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider">Precio</th>
                <th className="text-left px-4 py-3 text-xs text-foreground/45 uppercase tracking-wider">Subtotal</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.product.id} className="border-b border-foreground/[0.06]">
                  <td className="px-4 py-3 text-foreground">
                    {item.product.brand} {item.product.model} T{item.product.size}
                    <span className="text-foreground/55 text-xs ml-1">({item.product.color})</span>
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
                  <td className="px-4 py-3 text-foreground/70">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency((item.unit_price - item.discount) * item.quantity)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
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
                <td className="px-4 py-3 font-bold text-xl text-foreground">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
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
