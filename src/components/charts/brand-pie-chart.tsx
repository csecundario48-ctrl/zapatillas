'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

const COLORS = ['#6366f1', '#a78bfa', '#34d399', '#f59e0b', '#f472b6', '#60a5fa', '#fb7185', '#4ade80']

interface BrandData {
  name: string
  value: number
}

export function BrandPieChart({ data }: { data: BrandData[] }) {
  if (data.length === 0) {
    return <p className="text-center text-[#6e6e6e] text-sm py-12">Sin datos de ventas aún</p>
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={100}
          strokeWidth={0}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: '8px',
            color: '#fff',
            fontSize: 12,
          }}
        />
        <Legend
          formatter={(value) => <span style={{ color: '#888', fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
