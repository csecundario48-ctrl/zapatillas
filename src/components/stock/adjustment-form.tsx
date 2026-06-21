'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { adjustStock } from '@/app/actions/stock'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AdjustmentReason } from '@/types/database'

const sel = 'w-full bg-[#0f0f0f] border border-white/10 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors'

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
    setError(null)
    if (quantityChange === 0) {
      setError('El cambio debe ser distinto de 0')
      return
    }
    if (resultingStock < 0) {
      setError('El stock no puede quedar negativo')
      return
    }
    setLoading(true)
    const { error } = await adjustStock(productId, quantityChange, reason, notes)
    if (error) {
      setError(error)
      setLoading(false)
      return
    }
    toast.success(`Stock ajustado a ${resultingStock} ud.`)
    router.refresh()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] px-3 py-2.5">
        <p className="text-sm text-white font-medium">{productName}</p>
        <p className="text-xs text-[#555] mt-0.5">
          Stock actual: <span className="text-[#888] font-semibold">{currentStock}</span> ud.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#666] uppercase tracking-wider">Cambio de cantidad</Label>
        <Input
          type="number"
          value={quantityChange}
          onChange={e => setQuantityChange(Number(e.target.value))}
          placeholder="+5 o -3"
        />
        <p className="text-xs text-[#555]">
          Stock resultante:{' '}
          <span className={`font-semibold ${resultingStock < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {resultingStock}
          </span>
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#666] uppercase tracking-wider">Motivo</Label>
        <select value={reason} onChange={e => setReason(e.target.value as AdjustmentReason)} className={sel}>
          <option value="ajuste_manual" className="bg-[#111]">Ajuste manual</option>
          <option value="rotura" className="bg-[#111]">Rotura</option>
          <option value="perdida" className="bg-[#111]">Pérdida</option>
          <option value="devolucion_proveedor" className="bg-[#111]">Devolución a proveedor</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-[#666] uppercase tracking-wider">Notas (opcional)</Label>
        <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej: conteo físico de cierre de mes" />
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? 'Guardando...' : 'Confirmar ajuste'}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
