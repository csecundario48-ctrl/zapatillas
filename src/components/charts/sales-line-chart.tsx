'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils/format'

interface DataPoint {
  month: string
  total: number
}

export function SalesLineChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) {
    return <p className="text-center text-[#6e6e6e] text-sm py-12">Sin datos de ventas aún</p>
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#555' }}
          axisLine={{ stroke: '#1f1f1f' }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 11, fill: '#555' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#fff',
            fontSize: 12,
          }}
          formatter={(v) => [formatCurrency(Number(v)), 'Ventas']}
          labelStyle={{ color: '#888' }}
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
