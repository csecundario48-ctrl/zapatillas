'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { navGroups } from './nav-config'

export function MobileNav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <button
            type="button"
            aria-label="Abrir menú"
            className="md:hidden p-1.5 -ml-1.5 rounded-md text-foreground/75 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
          />
        }
      >
        <Menu size={18} />
      </SheetTrigger>
      <SheetContent side="left" className="w-[250px] bg-background border-foreground/[0.06] p-0">
        <SheetTitle className="sr-only">Navegación</SheetTitle>
        <div className="px-5 h-14 flex items-center border-b border-foreground/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kala-logo.png" alt="KALA" className="h-[18px] w-auto invert dark:invert-0" />
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
          {navGroups.map(({ label, items }) => (
            <div key={label}>
              <p className="px-2.5 mb-1 text-[10px] font-semibold text-foreground/45 uppercase tracking-[0.12em]">
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map(({ href, label: itemLabel, icon: Icon }) => {
                  const isActive = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        'group flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors',
                        isActive
                          ? 'bg-foreground/[0.07] text-foreground'
                          : 'text-foreground/70 hover:text-foreground hover:bg-foreground/[0.04]'
                      )}
                    >
                      <Icon
                        size={15}
                        className={cn('shrink-0', isActive ? 'text-indigo-400' : 'text-foreground/55')}
                      />
                      {itemLabel}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
