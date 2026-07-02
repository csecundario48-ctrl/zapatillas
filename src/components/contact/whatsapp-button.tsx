'use client'

import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { waLink, waTemplates, waTemplateLabels, type WaTemplateKey } from '@/lib/utils/whatsapp'

interface WhatsAppButtonProps {
  phone: string | null
  name?: string | null
  /** Show customer-facing message templates in a menu. */
  withTemplates?: boolean
  label?: string
}

export function WhatsAppButton({ phone, name, withTemplates = false, label }: WhatsAppButtonProps) {
  const [open, setOpen] = useState(false)
  const enabled = !!waLink(phone)

  if (!enabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground/40" title="Sin teléfono cargado">
        <MessageCircle size={13} /> Sin tel.
      </span>
    )
  }

  const open_ = (msg?: string) => {
    const url = waLink(phone, msg)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    setOpen(false)
  }

  if (!withTemplates) {
    return (
      <button
        type="button"
        onClick={() => open_()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
      >
        <MessageCircle size={13} /> {label ?? 'WhatsApp'}
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/15 transition-colors"
      >
        <MessageCircle size={13} /> {label ?? 'WhatsApp'}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1.5 w-52 rounded-lg border border-foreground/10 bg-card shadow-xl py-1">
            <button
              type="button"
              onClick={() => open_()}
              className="w-full text-left px-3 py-2 text-[12px] text-foreground/85 hover:bg-foreground/[0.04] transition-colors"
            >
              Abrir chat
            </button>
            <div className="my-1 h-px bg-foreground/[0.06]" />
            {(Object.keys(waTemplates) as WaTemplateKey[]).map(key => (
              <button
                key={key}
                type="button"
                onClick={() => open_(waTemplates[key](name))}
                className="w-full text-left px-3 py-2 text-[12px] text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground transition-colors"
              >
                {waTemplateLabels[key]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
