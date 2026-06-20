'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import type { Product } from '@/types/database'

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
        setError(`Stock insuficiente: solo hay ${product.stock_quantity} unidad(es) de ${product.brand} ${product.model} T${product.size}`)
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
    if (items.length === 0) {
      setError('Agregá al menos un producto')
      return
    }
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

    if (saleError) {
      setError(saleError.message)
      setLoading(false)
      return
    }

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

    if (itemsError) {
      setError(itemsError.message)
      setLoading(false)
      return
    }

    router.push('/ventas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1">
          <Label>Fecha</Label>
          <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Canal</Label>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-white"
          >
            <option value="fisica">Física</option>
            <option value="online">Online</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label>Medio de pago</Label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm bg-white"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="mercadopago">MercadoPago</option>
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Buscar producto</Label>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Nike Air Force 1 Blanco Talle 42..."
        />
        {search && (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto bg-white shadow-sm">
            {filteredProducts.slice(0, 8).map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => addItem(p)}
                className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex justify-between items-center"
              >
                <span>{p.brand} {p.model} — {p.color} T{p.size}</span>
                <span className="text-gray-500 text-xs ml-2">
                  Stock: {p.stock_quantity} | {formatCurrency(p.sale_price)}
                </span>
              </button>
            ))}
            {filteredProducts.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-500">Sin resultados con stock disponible</p>
            )}
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b">
                <th className="text-left p-3">Producto</th>
                <th className="text-left p-3">Cant.</th>
                <th className="text-left p-3">Precio</th>
                <th className="text-left p-3">Subtotal</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.product.id} className="border-b">
                  <td className="p-3">
                    {item.product.brand} {item.product.model} T{item.product.size}
                    <span className="text-xs text-gray-400 ml-1">({item.product.color})</span>
                  </td>
                  <td className="p-3">
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
                  <td className="p-3">{formatCurrency(item.unit_price)}</td>
                  <td className="p-3 font-medium">
                    {formatCurrency((item.unit_price - item.discount) * item.quantity)}
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
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
                <td className="p-3 font-bold text-lg">{formatCurrency(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}
      <Button type="submit" disabled={loading || items.length === 0} className="w-full">
        {loading ? 'Registrando venta...' : `Confirmar venta — ${formatCurrency(total)}`}
      </Button>
    </form>
  )
}
