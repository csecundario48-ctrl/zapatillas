'use client'

import { useRef, useEffect, useState } from 'react'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  color?: 'cyan' | 'green' | 'violet' | 'red' | 'amber'
  icon?: React.ReactNode
  prefix?: string
  suffix?: string
}

const colorMap = {
  cyan:   { bar: 'bg-indigo-400',    glow: 'rgba(99,102,241,0.12)',    text: 'text-indigo-400' },
  green:  { bar: 'bg-emerald-500 dark:bg-emerald-400', glow: 'rgba(52,211,153,0.12)',    text: 'text-emerald-600 dark:text-emerald-400' },
  violet: { bar: 'bg-violet-400',  glow: 'rgba(167,139,250,0.12)',   text: 'text-violet-400' },
  red:    { bar: 'bg-red-500 dark:bg-red-400',     glow: 'rgba(248,113,113,0.12)',   text: 'text-red-600 dark:text-red-400' },
  amber:  { bar: 'bg-amber-400',   glow: 'rgba(251,191,36,0.12)',    text: 'text-amber-600 dark:text-amber-400' },
}

function useAnimatedNumber(target: number, duration = 1200) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    let start: number | null = null
    function step(ts: number) {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(target * eased))
      if (progress < 1) requestAnimationFrame(step)
    }
    const id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [target, duration])
  return current
}

export function KpiCard({ title, value, subtitle, color = 'cyan', icon, prefix = '', suffix = '' }: KpiCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const { bar, glow, text } = colorMap[color]

  const numericValue = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g, ''))
  const isNumeric = !isNaN(numericValue) && numericValue > 0
  const animatedNum = useAnimatedNumber(isNumeric ? Math.round(numericValue) : 0)

  const displayValue = isNumeric
    ? `${prefix}${animatedNum.toLocaleString('es-AR')}${suffix}`
    : `${prefix}${value}${suffix}`

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2
    const x = e.clientX - rect.left - cx
    const y = e.clientY - rect.top - cy
    const rotY = (x / cx) * 8
    const rotX = -(y / cy) * 5
    card.style.transform = `perspective(600px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.025)`
    card.style.boxShadow = `0 24px 60px rgba(0,0,0,0.5), 0 0 30px ${glow}`
  }

  function handleMouseLeave() {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'
    card.style.boxShadow = ''
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden rounded-xl bg-card border border-foreground/[0.08] p-6 cursor-default"
      style={{ transition: 'transform 0.12s ease-out, box-shadow 0.12s ease-out', transformStyle: 'preserve-3d' }}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${bar}`} />

      {/* Radial glow on hover */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 transition-opacity duration-500 hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glow} 0%, transparent 70%)` }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-foreground/55 uppercase tracking-widest">{title}</p>
          {icon && <div className="text-foreground/40 mt-0.5">{icon}</div>}
        </div>
        <p className={`text-3xl font-bold tracking-tight ${text}`}>{displayValue}</p>
        {subtitle && <p className="text-xs text-foreground/55 mt-2">{subtitle}</p>}
      </div>
    </div>
  )
}
