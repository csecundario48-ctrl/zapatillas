import { createClient } from '@/lib/supabase/server'
import { ProveedoresClient, type SupplierRow } from './proveedores-client'

export default async function ProveedoresPage() {
  const supabase = await createClient()

  const [{ data: suppliers }, { data: purchases }] = await Promise.all([
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('purchases').select('supplier_id, total_amount, purchase_date, payment_status'),
  ])

  const agg: Record<string, { count: number; total: number; debt: number; last: string | null }> = {}
  for (const p of purchases ?? []) {
    if (!p.supplier_id) continue
    const a = agg[p.supplier_id] ?? { count: 0, total: 0, debt: 0, last: null }
    a.count += 1
    a.total += p.total_amount
    if (p.payment_status !== 'pagado') a.debt += p.total_amount
    if (!a.last || p.purchase_date > a.last) a.last = p.purchase_date
    agg[p.supplier_id] = a
  }

  const now = Date.now()
  const rows: SupplierRow[] = (suppliers ?? []).map(s => {
    const a = agg[s.id] ?? { count: 0, total: 0, debt: 0, last: null }
    const daysSince = a.last
      ? Math.floor((now - new Date(a.last).getTime()) / 86_400_000)
      : null
    return {
      id: s.id,
      name: s.name,
      contactName: s.contact_name,
      phone: s.phone,
      email: s.email,
      address: s.address,
      notes: s.notes,
      purchases: a.count,
      totalBought: a.total,
      debt: a.debt,
      lastPurchase: a.last,
      daysSince,
    }
  })

  rows.sort((a, b) => b.debt - a.debt || b.totalBought - a.totalBought || a.name.localeCompare(b.name))

  return <ProveedoresClient rows={rows} />
}
