'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { navGroups } from './nav-config'
import { useSettings } from '@/components/settings/settings-context'

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname()
  const { businessName, logoUrl } = useSettings()

  return (
    <aside
      className={cn(
        'flex flex-col w-[220px] shrink-0 bg-background border-r border-foreground/[0.06] min-h-screen',
        className
      )}
    >
      {/* Logo */}
      <div className="px-5 h-14 flex items-center border-b border-foreground/[0.06]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={businessName} className="h-6 w-auto max-w-[140px] object-contain" />
        ) : (
          <span className="font-semibold text-sm tracking-tight text-foreground truncate">{businessName}</span>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
        {navGroups.map(({ label, items }) => (
          <div key={label}>
            <p className="px-2.5 mb-1 font-mono text-[10px] font-medium text-foreground/40 uppercase tracking-[0.16em]">
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
                        ? 'bg-foreground/[0.07] text-foreground'
                        : 'text-foreground/55 hover:text-foreground/85 hover:bg-foreground/[0.04]'
                    )}
                  >
                    <Icon
                      size={14}
                      className={cn(
                        'shrink-0',
                        isActive ? 'text-indigo-400' : 'text-foreground/45 group-hover:text-foreground/70'
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
      <div className="px-5 py-3.5 border-t border-foreground/[0.06]">
        <p className="text-[10px] text-foreground/30 font-mono tracking-widest uppercase truncate">{businessName} · v1.0</p>
      </div>
    </aside>
  )
}
