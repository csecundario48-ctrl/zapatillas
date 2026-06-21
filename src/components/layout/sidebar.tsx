'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Truck,
  Receipt,
  TrendingUp,
  BarChart3,
} from 'lucide-react'

const navGroups = [
  {
    label: 'Principal',
    items: [
      { href: '/', label: 'Inicio', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Inventario',
    items: [
      { href: '/catalogo', label: 'Catálogo', icon: Package },
      { href: '/stock', label: 'Stock', icon: Boxes },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
      { href: '/compras', label: 'Compras', icon: Truck },
      { href: '/egresos', label: 'Egresos', icon: Receipt },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/finanzas', label: 'Finanzas', icon: TrendingUp },
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
]

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex flex-col w-[220px] shrink-0 bg-[#080808] border-r border-white/[0.06] min-h-screen',
        className
      )}
    >
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center text-xs">
            👟
          </div>
          <span className="font-semibold text-[13px] tracking-tight text-white">
            Zapatillas
          </span>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-2.5 mb-1 text-[10px] font-semibold text-[#2e2e2e] uppercase tracking-[0.12em]">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ href, label: itemLabel, icon: Icon }) => {
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'group flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[13px] font-medium transition-all duration-100',
                      isActive
                        ? 'bg-white/[0.07] text-white'
                        : 'text-[#555] hover:text-[#bbb] hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon
                      size={14}
                      className={cn(
                        'shrink-0',
                        isActive ? 'text-indigo-400' : 'text-[#444] group-hover:text-[#888]'
                      )}
                    />
                    {itemLabel}
                    {isActive && (
                      <span className="ml-auto w-1 h-1 rounded-full bg-indigo-400 shrink-0" />
                    )}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3.5 border-t border-white/[0.06]">
        <p className="text-[10px] text-[#2a2a2a] font-mono tracking-widest uppercase">v1.0</p>
      </div>
    </aside>
  )
}
