'use client'

import { createContext, useContext } from 'react'

export interface AppSettings {
  businessName: string
  logoUrl: string | null
  sizeMin: number
  sizeMax: number
}

const DEFAULTS: AppSettings = { businessName: 'KALA', logoUrl: null, sizeMin: 35, sizeMax: 45 }

const SettingsContext = createContext<AppSettings>(DEFAULTS)

export function SettingsProvider({ value, children }: { value: AppSettings; children: React.ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): AppSettings {
  return useContext(SettingsContext)
}
