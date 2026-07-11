'use client'

import { useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'

// true recién tras la hidratación en el cliente; evita el mismatch de SSR
// sin disparar un setState sincrónico dentro de un efecto.
const emptySubscribe = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useMounted()

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
