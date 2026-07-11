import { ViewTransition } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsProvider } from '@/components/settings/settings-context'
import type { BusinessSettings } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { count: criticalCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('active', true)
    .eq('stock_quantity', 0)

  const { data: settingsRow } = await supabase
    .from('business_settings')
    .select('business_name, logo_url, size_min, size_max')
    .eq('id', 1)
    .single()
  const s = settingsRow as Pick<BusinessSettings, 'business_name' | 'logo_url' | 'size_min' | 'size_max'> | null
  const appSettings = {
    businessName: s?.business_name ?? 'KALA',
    logoUrl: s?.logo_url ?? null,
    sizeMin: s?.size_min ?? 35,
    sizeMax: s?.size_max ?? 45,
  }

  return (
    <SettingsProvider value={appSettings}>
    <div className="relative isolate flex h-screen overflow-hidden bg-background">
      {/* Aurora glow backdrop (Linear-style) */}
      <div className="aurora" />

      {/* Sidebar — frozen during page transitions */}
      <div className="relative z-10" style={{ viewTransitionName: 'dashboard-sidebar' }}>
        <Sidebar className="hidden md:flex" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Giant faint KALA watermark behind every section */}
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kala-logo.png" alt="" className="w-[62%] max-w-4xl opacity-[0.05] dark:opacity-[0.03] invert dark:invert-0 select-none" />
        </div>

        {/* Header — frozen during page transitions */}
        <div className="relative z-10" style={{ viewTransitionName: 'dashboard-header' }}>
          <Header userEmail={user.email ?? ''} criticalCount={criticalCount ?? 0} />
        </div>

        <main className="relative z-10 flex-1 overflow-y-auto">
          {/* Page content slides in/out on navigation */}
          <ViewTransition enter="page-slide" exit="page-slide">
            <div className="p-5 md:p-7">{children}</div>
          </ViewTransition>
        </main>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
    </SettingsProvider>
  )
}
