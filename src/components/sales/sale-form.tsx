'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createSale, updateSale } from '@/app/actions/sales'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency, formatDateForInput } from '@/lib/utils/format'
import { remainingAmount } from '@/lib/utils/deposit'
import type { Customer, SaleChannel, SaleStatus, PaymentMethod } from '@/types/database'

const sel = 'w-full bg-card border border-foreground/10 text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

export interface VariantOption {
  id: string
  product_id: string
  brand: string
  model: string
  color: string
  size: string
  stock_quantity: number
  sale_price: number
  cost_price: number
}

interface SaleItem {
  variant: VariantOption
  quantity: number
  unit_price: number
  discount: number
}

export interface SaleForEdit {
  id: string
  status: SaleStatus
  sale_date: string
  channel: SaleChannel
  payment_method: PaymentMethod
  customer_id: string | null
  deposit_amount: number
  items: { variant_id: string; quantity: number; unit_price: number; discount: number }[]
  /** Ítems cuyo producto se borró del catálogo. Se conservan sin cambios al guardar. */
  orphan: { count: number; total: number }
}

export function SaleForm({
  variants,
  customers,
  sale,
}: {
  variants: VariantOption[]
  customers: Customer[]
  sale?: SaleForEdit
}) {
  const isEdit = !!sale
  const router = useRouter()
  const [items, setItems] = useState<SaleItem[]>(() => {
    if (!sale) return []
    const byId = new Map(variants.map(v => [v.id, v]))
    return sale.items.flatMap(i => {
      const variant = byId.get(i.variant_id)
      return variant
        ? [{ variant, quantity: i.quantity, unit_price: i.unit_price, discount: i.discount }]
        : []
    })
  })
  const [customerId, setCustomerId] = useState(sale?.customer_id ?? '')
  const [channel, setChannel] = useState<string>(sale?.channel ?? 'fisica')
  const [paymentMethod, setPaymentMethod] = useState<string>(sale?.payment_method ?? 'efectivo')
  const [saleDate, setSaleDate] = useState(sale?.sale_date ?? formatDateForInput())
  // En edición el estado no se cambia: esto solo refleja el que ya tiene.
  const [isEncargo, setIsEncargo] = useState(sale ? sale.status === 'encargo' : false)
  const [deposit, setDeposit] = useState(sale?.deposit_amount ?? 0)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  /** Cantidad de cada variante que esta venta ya tiene reservada. */
  const originalQty = new Map(sale?.items.map(i => [i.variant_id, i.quantity]) ?? [])

  // Un registro que no retiene stock no tiene tope: un encargo descuenta recién
  // al completarse, y una devolución o cancelada ya repuso o nunca descontó.
  const unlimited = isEncargo || (isEdit && sale.status !== 'completada')

  /**
   * Máximo vendible de una variante. En una venta completada, las unidades que
   * esta misma venta ya descontó vuelven a estar disponibles para ella: sin
   * esto, editar la venta que agotó el último par sería imposible.
   */
  function maxFor(v: VariantOption) {
    return unlimited ? Infinity : v.stock_quantity + (originalQty.get(v.id) ?? 0)
  }

  const filteredVariants = variants.filter(
    v =>
      maxFor(v) > 0 &&
      `${v.brand} ${v.model} ${v.color} ${v.size}`
        .toLowerCase()
        .includes(search.toLowerCase())
  )

  function addItem(variant: VariantOption) {
    const existing = items.find(i => i.variant.id === variant.id)
    if (existing) {
      if (existing.quantity >= maxFor(variant)) {
        setError(`Stock insuficiente: solo hay ${maxFor(variant)} ud. de ${variant.brand} ${variant.model} T${variant.size}`)
        return
      }
      setItems(items.map(i =>
        i.variant.id === variant.id ? { ...i, quantity: i.quantity + 1 } : i
      ))
    } else {
      setItems([...items, { variant, quantity: 1, unit_price: variant.sale_price, discount: 0 }])
    }
    setSearch('')
    setError(null)
  }

  function removeItem(variantId: string) {
    setItems(items.filter(i => i.variant.id !== variantId))
  }

  // Enter en el buscador: agrega el único resultado (lector de barras tipea
  // el código + Enter y el filtro suele quedar en un solo match), en vez de
  // enviar el form.
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const term = search.trim().toLowerCase()
    if (!term) return
    if (filteredVariants.length === 1) addItem(filteredVariants[0])
  }

  const itemsTotal = items.reduce((sum, i) => sum + (i.unit_price - i.discount) * i.quantity, 0)
  const total = itemsTotal + (sale?.orphan.total ?? 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (items.length === 0) { setError('Agregá al menos un producto'); return }
    if (!customerId) { setError('Seleccioná un cliente'); return }
    setLoading(true)
    setError(null)

    const payload = {
      sale_date: saleDate,
      channel: channel as 'fisica' | 'online',
      payment_method: paymentMethod as 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago',
      customer_id: customerId,
      items: items.map(i => ({
        variant_id: i.variant.id,
        quantity: i.quantity,
        unit_price: i.unit_price,
        discount: i.discount,
      })),
    }

    if (isEdit) {
      const { error: updError, movedStock } = await updateSale(sale.id, {
        ...payload,
        deposit_amount: deposit,
      })
      if (updError) { setError(updError); setLoading(false); return }
      toast.success(movedStock ? 'Venta actualizada — stock ajustado' : 'Venta actualizada')
      router.push(sale.status === 'encargo' ? '/encargos' : '/ventas')
      router.refresh()
      return
    }

    const { error: saleError } = await createSale({
      ...payload,
      is_encargo: isEncargo,
      deposit_amount: isEncargo ? deposit : 0,
    })

    if (saleError) { setError(saleError); setLoading(false); return }

    toast.success(isEncargo ? `Encargo registrado — seña ${formatCurrency(deposit)}` : `Venta registrada — ${formatCurrency(total)}`)
    router.push(isEncargo ? '/encargos' : '/ventas')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Cliente</Label>
          <select value={customerId} onChange={e => setCustomerId(e.target.value)} className={sel}>
            <option value="" className="bg-card">Seleccionar cliente</option>
            {customers.map(c => (
              <option key={c.id} value={c.id} className="bg-card">{c.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Fecha</Label>
          <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Canal</Label>
          <select value={channel} onChange={e => setChannel(e.target.value)} className={sel}>
            <option value="fisica" className="bg-card">Física</option>
            <option value="online" className="bg-card">Online</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Medio de pago</Label>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={sel}>
            <option value="efectivo" className="bg-card">Efectivo</option>
            <option value="transferencia" className="bg-card">Transferencia</option>
            <option value="tarjeta" className="bg-card">Tarjeta</option>
            <option value="mercadopago" className="bg-card">MercadoPago</option>
          </select>
        </div>
        {!isEdit && (
          <div className="space-y-1.5 sm:col-span-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isEncargo}
                onChange={e => { setIsEncargo(e.target.checked); if (!e.target.checked) setDeposit(0) }}
                className="accent-indigo-500 size-4"
              />
              <span className="text-sm text-foreground">Es encargo (seña por un producto sin stock)</span>
            </label>
          </div>
        )}
        {isEncargo && (
          <div className="space-y-1.5">
            <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Seña</Label>
            <Input
              type="number"
              min={0}
              value={deposit}
              onChange={e => setDeposit(Math.max(0, Number(e.target.value)))}
              placeholder="0"
            />
            <p className="text-[11px] text-foreground/55">Resto a pagar: {formatCurrency(remainingAmount(total, deposit))}</p>
          </div>
        )}
        {sale && sale.orphan.count > 0 && (
          <p className="sm:col-span-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            Esta venta incluye {sale.orphan.count} producto{sale.orphan.count > 1 ? 's' : ''} que ya no está{sale.orphan.count > 1 ? 'n' : ''} en el catálogo,
            por {formatCurrency(sale.orphan.total)}. Se conserva{sale.orphan.count > 1 ? 'n' : ''} sin cambios y suma{sale.orphan.count > 1 ? 'n' : ''} al total.
          </p>
        )}
      </div>

      {/* Product search */}
      <div className="space-y-2">
        <Label className="font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]">Buscar producto</Label>
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Marca, modelo, color o talle..."
        />
        {search && (
          <div className="rounded-xl border border-foreground/10 bg-card divide-y divide-foreground/[0.06] max-h-52 overflow-y-auto shadow-xl">
            {filteredVariants.slice(0, 8).map(v => (
              <button
                key={v.id}
                type="button"
                onClick={() => addItem(v)}
                className="w-full text-left px-4 py-2.5 hover:bg-foreground/[0.03] text-sm flex justify-between items-center transition-colors"
              >
                <span className="text-foreground">
                  {v.brand} {v.model}
                  <span className="text-foreground/60 ml-1">— {v.color} T{v.size}</span>
                </span>
                <span className="text-foreground/55 text-xs ml-3 shrink-0">
                  Stock: <span className={v.stock_quantity === 1 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}>{v.stock_quantity}</span>
                  {' · '}{formatCurrency(v.sale_price)}
                </span>
              </button>
            ))}
            {filteredVariants.length === 0 && (
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
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Producto</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Cant.</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-foreground/45 uppercase tracking-[0.14em]">Precio</th>
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
                      max={unlimited ? undefined : maxFor(item.variant)}
                      value={item.quantity}
                      className="w-16"
                      onChange={e => {
                        const raw = Math.max(1, Number(e.target.value))
                        const qty = Math.min(raw, maxFor(item.variant))
                        setItems(items.map(i =>
                          i.variant.id === item.variant.id ? { ...i, quantity: qty } : i
                        ))
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-foreground/70">{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {formatCurrency((item.unit_price - item.discount) * item.quantity)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => removeItem(item.variant.id)}
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
                <td className="px-4 py-3 font-mono font-semibold text-lg text-foreground tabular-nums">{formatCurrency(total)}</td>
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
        {loading
          ? 'Guardando...'
          : isEdit
            ? `Guardar cambios — ${formatCurrency(total)}`
            : isEncargo
              ? `Confirmar encargo — seña ${formatCurrency(deposit)}`
              : `Confirmar venta — ${formatCurrency(total)}`}
      </Button>
    </form>
  )
}
