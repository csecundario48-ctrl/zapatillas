'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DataPoint {
  month: string
  ingresos: number
  egresos: number
}

export function CashflowBarChart({ data }: { data: DataPoint[] }) {
  if (data.every(d => d.ingresos === 0 && d.egresos === 0)) {
    return <p className="text-center text-foreground/45 text-sm py-12">Sin movimientos en los últimos meses</p>
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--popover-foreground)',
            fontSize: 12,
          }}
          formatter={(v, name) => [formatCurrency(Number(v)), name === 'ingresos' ? 'Ingresos' : 'Egresos']}
          labelStyle={{ color: 'var(--muted-foreground)' }}
          cursor={{ fill: 'var(--border)', opacity: 0.3 }}
        />
        <Legend
          formatter={(value: string) => (
            <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
              {value === 'ingresos' ? 'Ingresos' : 'Egresos'}
            </span>
          )}
        />
        <Bar dataKey="ingresos" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
        <Bar dataKey="egresos" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
