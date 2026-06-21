'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Email o contraseña incorrectos')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#08090a]">
      {/* ─── Left: form ─── */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kala-logo.png" alt="KALA" className="h-7 w-auto mb-6" />
            <h1 className="text-xl font-semibold text-white">Bienvenido de nuevo</h1>
            <p className="text-sm text-[#828282] mt-1">Ingresá a tu cuenta para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-[#969696] uppercase tracking-wider">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@email.com"
                className="w-full px-4 py-2.5 rounded-lg bg-[#131419] border border-white/10 text-white text-sm placeholder:text-[#6e6e6e] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-[#969696] uppercase tracking-wider">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-4 py-2.5 rounded-lg bg-[#131419] border border-white/10 text-white text-sm placeholder:text-[#6e6e6e] focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-[0_0_20px_rgba(99,102,241,0.25)]"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>

      {/* ─── Right: brand panel (hidden on mobile) ─── */}
      <div className="hidden lg:flex relative items-center justify-center overflow-hidden border-l border-white/[0.06]">
        <div className="aurora" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full bg-indigo-500/[0.06] blur-[130px]" />

        <div className="relative z-10 max-w-md px-14">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kala-logo.png" alt="KALA" className="h-9 w-auto mb-7" />
          <h2 className="text-3xl font-semibold text-white leading-[1.2] tracking-tight">
            Todo tu negocio, en un solo lugar.
          </h2>
          <p className="text-[#a8a8a8] mt-5 leading-relaxed">
            Ventas, stock, compras y finanzas — claros y al instante.
          </p>

          <div className="flex gap-8 mt-10 pt-8 border-t border-white/[0.06]">
            <div>
              <p className="text-2xl font-semibold text-white tracking-tight">8</p>
              <p className="text-xs text-[#828282] mt-1">secciones</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white tracking-tight">Tiempo real</p>
              <p className="text-xs text-[#828282] mt-1">sin recargar</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
