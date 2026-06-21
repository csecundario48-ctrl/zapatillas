import { createClient } from '@/lib/supabase/server'
import { ClientesClient, type CustomerRow } from './clientes-client'

const VIP_MIN_SPENT = 300_000
const FRECUENTE_MIN_PURCHASES = 3
const INACTIVE_DAYS = 60

export default async function ClientesPage() {
  const supabase = await createClient()

  const [{ data: customers }, { data: sales }] = await Promise.all([
    supabase.from('customers').select('*').order('name'),
    supabase
      .from('sales')
      .select('customer_id, total_amount, sale_date')
      .eq('status', 'completada'),
  ])

  // Aggregate sales per customer
  const agg: Record<string, { count: number; total: number; last: string | null }> = {}
  for (const s of sales ?? []) {
    if (!s.customer_id) continue
    const a = agg[s.customer_id] ?? { count: 0, total: 0, last: null }
    a.count += 1
    a.total += s.total_amount
    if (!a.last || s.sale_date > a.last) a.last = s.sale_date
    agg[s.customer_id] = a
  }

  const now = Date.now()
  const rows: CustomerRow[] = (customers ?? []).map(c => {
    const a = agg[c.id] ?? { count: 0, total: 0, last: null }
    const daysSince = a.last
      ? Math.floor((now - new Date(a.last).getTime()) / 86_400_000)
      : null

    const badges: CustomerRow['badges'] = []
    if (a.count === 0) badges.push('nuevo')
    else {
      if (a.total >= VIP_MIN_SPENT) badges.push('vip')
      if (a.count >= FRECUENTE_MIN_PURCHASES) badges.push('frecuente')
      if (daysSince !== null && daysSince > INACTIVE_DAYS) badges.push('inactivo')
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      instagram: c.instagram,
      address: c.address,
      purchases: a.count,
      totalSpent: a.total,
      lastPurchase: a.last,
      daysSince,
      badges,
    }
  })

  // Most valuable first
  rows.sort((a, b) => b.totalSpent - a.totalSpent || a.name.localeCompare(b.name))

  return <ClientesClient rows={rows} />
}
