'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { updateBusinessSettings, updateLogo } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const lbl = 'font-mono text-[10px] text-foreground/60 uppercase tracking-[0.14em]'

interface Props {
  businessName: string
  logoUrl: string | null
  sizeMin: number
  sizeMax: number
}

export function BusinessSettingsForm({ businessName, logoUrl, sizeMin, sizeMax }: Props) {
  const router = useRouter()
  const [name, setName] = useState(businessName)
  const [min, setMin] = useState(sizeMin)
  const [max, setMax] = useState(sizeMax)
  const [logo, setLogo] = useState<string | null>(logoUrl)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function onSave() {
    setSaving(true)
    const { error } = await updateBusinessSettings({ business_name: name, size_min: min, size_max: max })
    setSaving(false)
    if (error) { toast.error(error); return }
    toast.success('Datos del negocio guardados')
    router.refresh()
  }

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const supabase = createClient()
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `logo-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('business').upload(path, file, { upsert: true })
    if (upErr) { setUploading(false); toast.error(`No se pudo subir: ${upErr.message}`); return }
    const { data } = supabase.storage.from('business').getPublicUrl(path)
    const url = data.publicUrl
    const { error } = await updateLogo(url)
    setUploading(false)
    if (error) { toast.error(error); return }
    setLogo(url)
    toast.success('Logo actualizado')
    router.refresh()
  }

  return (
    <div className="rounded-xl border border-foreground/[0.08] bg-card p-6 space-y-5">
      <h2 className="text-sm font-semibold text-foreground">Datos del negocio</h2>

      <div className="space-y-1.5 max-w-sm">
        <Label className={lbl}>Nombre del negocio</Label>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Mi Negocio" />
      </div>

      <div className="space-y-1.5">
        <Label className={lbl}>Logo</Label>
        <div className="flex items-center gap-4">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="Logo" className="h-10 w-auto max-w-[160px] object-contain rounded border border-foreground/10 bg-background p-1" />
          ) : (
            <span className="text-xs text-foreground/45">Sin logo</span>
          )}
          <label className="cursor-pointer text-xs text-indigo-400 hover:text-indigo-300">
            {uploading ? 'Subiendo...' : 'Subir imagen'}
            <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="space-y-1.5 max-w-xs">
        <Label className={lbl}>Rango de talles</Label>
        <div className="flex items-center gap-2">
          <Input type="number" min={1} value={min} onChange={e => setMin(Number(e.target.value))} className="w-20 text-center" />
          <span className="text-foreground/45 text-sm">a</span>
          <Input type="number" min={1} value={max} onChange={e => setMax(Number(e.target.value))} className="w-20 text-center" />
        </div>
        <p className="text-[11px] text-foreground/55">Se usa al cargar el stock por talle de un producto.</p>
      </div>

      <Button onClick={onSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar datos del negocio'}
      </Button>
    </div>
  )
}
