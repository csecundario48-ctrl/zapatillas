'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navGroups } from './nav-items'

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
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/kala-logo.png" alt="KALA" className="h-[18px] w-auto" />
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-2.5 mb-1 font-mono text-[10px] font-medium text-[#54575e] uppercase tracking-[0.16em]">
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
                        : 'text-[#828282] hover:text-[#cfcfcf] hover:bg-white/[0.04]'
                    )}
                  >
                    <Icon
                      size={14}
                      className={cn(
                        'shrink-0',
                        isActive ? 'text-indigo-400' : 'text-[#6e6e6e] group-hover:text-[#a8a8a8]'
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
        <p className="font-mono text-[10px] text-[#4a4a4a] tracking-[0.16em] uppercase">KALA · v1.0</p>
      </div>
    </aside>
  )
}
