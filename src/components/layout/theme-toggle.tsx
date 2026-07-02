'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="w-7 h-7" />
  }

  const isDark = resolvedTheme === 'dark'

  return (
    <button
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
      className="w-7 h-7 rounded-md flex items-center justify-center text-foreground/45 hover:text-foreground hover:bg-foreground/[0.06] transition-colors"
    >
      {isDark ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  )
}
