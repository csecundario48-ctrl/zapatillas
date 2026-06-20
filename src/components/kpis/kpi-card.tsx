interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  color?: 'blue' | 'green' | 'yellow' | 'red'
}

const colorMap: Record<string, string> = {
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  yellow: 'border-l-yellow-500',
  red: 'border-l-red-500',
}

export function KpiCard({ title, value, subtitle, color = 'blue' }: KpiCardProps) {
  return (
    <div className={`bg-white rounded-lg border border-l-4 ${colorMap[color]} p-5`}>
      <p className="text-sm text-gray-500">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  )
}
