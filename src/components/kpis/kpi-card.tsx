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
  cyan:   { bar: 'bg-indigo-400',  glow: 'rgba(99,102,241,0.12)',  text: 'text-indigo-300' },
  green:  { bar: 'bg-emerald-400', glow: 'rgba(52,211,153,0.12)',  text: 'text-emerald-300' },
  violet: { bar: 'bg-violet-400',  glow: 'rgba(167,139,250,0.12)', text: 'text-violet-300' },
  red:    { bar: 'bg-red-400',     glow: 'rgba(248,113,113,0.12)', text: 'text-red-300' },
  amber:  { bar: 'bg-amber-400',   glow: 'rgba(251,191,36,0.12)',  text: 'text-amber-300' },
}

function useAnimatedNumber(target: number, duration = 1000) {
  const [current, setCurrent] = useState(0)
  useEffect(() => {
    let start: number | null = null
    let raf: number
    function step(ts: number) {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(target * eased))
      if (progress < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return current
}

/**
 * KPI como "etiqueta de caja": eyebrow mono con tracking ancho,
 * cifra grande en mono tabular — la voz del dato en todo el panel.
 */
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
    const rotY = (x / cx) * 4
    const rotX = -(y / cy) * 2.5
    card.style.transform = `perspective(700px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.015)`
    card.style.boxShadow = `0 18px 48px rgba(0,0,0,0.45), 0 0 26px ${glow}`
  }

  function handleMouseLeave() {
    const card = cardRef.current
    if (!card) return
    card.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)'
    card.style.boxShadow = ''
  }

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="group relative overflow-hidden rounded-xl bg-[#101116] border border-white/[0.07] p-5 cursor-default"
      style={{ transition: 'transform 0.14s ease-out, box-shadow 0.14s ease-out', transformStyle: 'preserve-3d' }}
    >
      {/* Barra de acento — el "color de la etiqueta" */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] ${bar} opacity-80`} />

      {/* Glow al hover (via group: el div es pointer-events-none) */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 0%, ${glow} 0%, transparent 70%)` }}
      />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-3.5">
          <p className="font-mono text-[10px] font-medium text-[#63666e] uppercase tracking-[0.16em]">
            {title}
          </p>
          {icon && <div className="text-[#5c5c5c] -mt-0.5">{icon}</div>}
        </div>
        <p className={`font-mono text-[26px] leading-none font-semibold tracking-tight tabular-nums ${text}`}>
          {displayValue}
        </p>
        {subtitle && <p className="text-[11px] text-[#787c85] mt-2.5">{subtitle}</p>}
      </div>
    </div>
  )
}
