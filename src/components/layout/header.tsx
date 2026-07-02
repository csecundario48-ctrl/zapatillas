'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertTriangle, LogOut } from 'lucide-react'
import { MobileNav } from './mobile-nav'

const pathLabels: Record<string, string> = {
  '/': 'Inicio',
  '/catalogo': 'Catálogo',
  '/stock': 'Stock',
  '/ventas': 'Ventas',
  '/compras': 'Compras',
  '/egresos': 'Egresos',
  '/finanzas': 'Finanzas',
  '/reportes': 'Reportes',
  '/ventas/nueva': 'Nueva Venta',
  '/compras/nueva': 'Nueva Compra',
}

interface HeaderProps {
  userEmail: string
  criticalCount: number
}

export function Header({ userEmail, criticalCount }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : '??'
  const pageTitle = pathLabels[pathname] ?? 'Dashboard'

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between h-14 px-5 border-b border-white/[0.06] shrink-0"
      style={{ backgroundColor: 'rgba(8,8,8,0.92)', backdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-2">
        <MobileNav />
        <h1 className="text-[13px] font-semibold text-white tracking-tight">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-2">
        {criticalCount > 0 && (
          <button
            onClick={() => router.push('/stock')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/15 transition-colors"
          >
            <AlertTriangle size={11} />
            {criticalCount} sin stock
          </button>
        )}

        <div
          title={userEmail}
          className="w-7 h-7 rounded-full bg-[#1f2026] border border-white/10 flex items-center justify-center text-[10px] font-bold text-[#a8a8a8] select-none"
        >
          {initials}
        </div>

        <button
          onClick={handleSignOut}
          title="Cerrar sesión"
          className="w-7 h-7 rounded-md flex items-center justify-center text-[#6e6e6e] hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={13} />
        </button>
      </div>
    </header>
  )
}
