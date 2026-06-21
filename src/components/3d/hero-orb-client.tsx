'use client'

import dynamic from 'next/dynamic'

const HeroOrb = dynamic(
  () => import('./hero-orb').then(m => m.HeroOrb),
  { ssr: false, loading: () => <div className="w-full h-full" /> }
)

export function HeroOrbClient() {
  return <HeroOrb />
}
