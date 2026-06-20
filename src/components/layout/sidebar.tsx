'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  BarChart2,
  ShoppingCart,
  Truck,
  Receipt,
  TrendingUp,
  FileText,
  LogOut,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/', label: 'Inicio', icon: LayoutDashboard },
  { href: '/catalogo', label: 'Catálogo', icon: Package },
  { href: '/stock', label: 'Stock', icon: BarChart2 },
  { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
  { href: '/compras', label: 'Compras', icon: Truck },
  { href: '/egresos', label: 'Egresos', icon: Receipt },
  { href: '/finanzas', label: 'Finanzas', icon: TrendingUp },
  { href: '/reportes', label: 'Reportes', icon: FileText },
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className={cn('flex flex-col w-64 bg-slate-900 text-white min-h-screen', className)}>
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold">👟 Zapatillas</h1>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              pathname === href
                ? 'bg-slate-700 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-slate-300 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <LogOut size={18} />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
