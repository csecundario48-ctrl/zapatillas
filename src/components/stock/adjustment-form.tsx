'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdjustmentReason } from '@/types/database'

interface AdjustmentFormProps {
  productId: string
  productName: string
  currentStock: number
  onClose: () => void
}

export function AdjustmentForm({ productId, productName, currentStock, onClose }: AdjustmentFormProps) {
  const router = useRouter()
  const [quantityChange, setQuantityChange] = useState(0)
  const [reason, setReason] = useState<AdjustmentReason>('ajuste_manual')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const resultingStock = currentStock + quantityChange

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (resultingStock < 0) {
      setError('El stock no puede quedar negativo')
      return
    }
    if (quantityChange === 0) {
      setError('El cambio debe ser distinto de 0')
      return
    }
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('stock_adjustments').insert({
      product_id: productId,
      quantity_change: quantityChange,
      reason,
      notes: notes || null,
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-600">
        <strong>{productName}</strong> — Stock actual: <strong>{currentStock}</strong>
      </p>
      <div className="space-y-1">
        <Label>Cambio de cantidad</Label>
        <Input
          type="number"
          value={quantityChange}
          onChange={e => setQuantityChange(Number(e.target.value))}
          placeholder="+5 o -3"
        />
        <p className="text-xs text-gray-500">
          Stock resultante: <strong className={resultingStock < 0 ? 'text-red-500' : ''}>{resultingStock}</strong>
        </p>
      </div>
      <div className="space-y-1">
        <Label>Motivo</Label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value as AdjustmentReason)}
          className="w-full border rounded px-3 py-2 text-sm bg-white"
        >
          <option value="ajuste_manual">Ajuste manual</option>
          <option value="rotura">Rotura</option>
          <option value="perdida">Pérdida</option>
          <option value="devolucion_proveedor">Devolución a proveedor</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label>Notas (opcional)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: conteo físico de cierre de mes" />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {loading ? 'Guardando...' : 'Confirmar ajuste'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
