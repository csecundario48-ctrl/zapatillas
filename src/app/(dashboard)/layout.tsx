import { ViewTransition } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { Toaster } from '@/components/ui/sonner'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

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

  return (
    <div className="relative isolate flex h-screen overflow-hidden bg-[#08090a]">
      {/* Aurora glow backdrop (Linear-style) */}
      <div className="aurora" />

      {/* Sidebar — frozen during page transitions */}
      <div className="relative z-10" style={{ viewTransitionName: 'dashboard-sidebar' }}>
        <Sidebar className="hidden md:flex" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col overflow-hidden">
        {/* Header — frozen during page transitions */}
        <div style={{ viewTransitionName: 'dashboard-header' }}>
          <Header userEmail={user.email ?? ''} criticalCount={criticalCount ?? 0} />
        </div>

        <main className="flex-1 overflow-y-auto">
          {/* Page content slides in/out on navigation */}
          <ViewTransition enter="page-slide" exit="page-slide">
            <div className="p-5 md:p-7">{children}</div>
          </ViewTransition>
        </main>
      </div>

      <Toaster position="bottom-right" richColors />
    </div>
  )
}
