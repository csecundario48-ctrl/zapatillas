import { createClient } from '@/lib/supabase/server'
import { BusinessSettingsForm } from '@/components/settings/business-settings-form'
import { ExpenseCategoriesManager } from '@/components/settings/expense-categories-manager'
import type { BusinessSettings, ExpenseCategoryRow } from '@/types/database'

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const [{ data: settingsRow }, { data: categoryRows }] = await Promise.all([
    supabase.from('business_settings').select('*').eq('id', 1).single(),
    supabase.from('expense_categories').select('*').order('name'),
  ])

  const s = settingsRow as BusinessSettings | null
  const categories = (categoryRows as ExpenseCategoryRow[] | null) ?? []

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Configuración</h1>
        <p className="text-sm text-foreground/55 mt-0.5">Datos del negocio, rango de talles y categorías de gastos</p>
      </div>

      <BusinessSettingsForm
        businessName={s?.business_name ?? 'Mi Negocio'}
        logoUrl={s?.logo_url ?? null}
        sizeMin={s?.size_min ?? 35}
        sizeMax={s?.size_max ?? 45}
      />

      <ExpenseCategoriesManager categories={categories} />
    </div>
  )
}
