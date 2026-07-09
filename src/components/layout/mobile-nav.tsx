'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navGroups } from './nav-items'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

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
            className="md:hidden w-8 h-8 rounded-md flex items-center justify-center text-[#a8a8a8] hover:text-white hover:bg-white/[0.06] transition-colors"
          />
        }
      >
        <Menu size={16} />
      </SheetTrigger>
      <SheetContent side="left" className="bg-[#0c0d10] border-white/[0.06] w-[260px] gap-0">
        <SheetHeader className="border-b border-white/[0.06]">
          <SheetTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/kala-logo.png" alt="KALA" className="h-[18px] w-auto" />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 px-2.5 py-3 space-y-4 overflow-y-auto">
          {navGroups.map(({ label, items }) => (
            <div key={label}>
              <p className="px-2.5 mb-1 text-[10px] font-semibold text-[#505050] uppercase tracking-[0.12em]">
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
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[14px] font-medium transition-colors',
                        isActive
                          ? 'bg-white/[0.07] text-white'
                          : 'text-[#828282] hover:text-[#cfcfcf] hover:bg-white/[0.04]'
                      )}
                    >
                      <Icon
                        size={15}
                        className={cn('shrink-0', isActive ? 'text-indigo-400' : 'text-[#6e6e6e]')}
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
