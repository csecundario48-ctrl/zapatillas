'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DataPoint {
  month: string
  total: number
}

export function SalesLineChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return <p className="text-center text-foreground/45 text-sm py-12">Sin datos de ventas aún</p>
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
          formatter={(v) => [formatCurrency(Number(v)), 'Ventas']}
          labelStyle={{ color: 'var(--muted-foreground)' }}
          cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '3 3' }}
        />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
