import { type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className = '', padding = true }: CardProps) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: ReactNode
  color?: 'green' | 'gold' | 'blue' | 'red' | 'orange' | 'purple'
  trend?: { value: number; label: string }
}

const colorMap = {
  green: { bg: 'bg-[#f0f7f3]', icon: 'text-[#1a4a2e]', badge: 'bg-[#1a4a2e]' },
  gold: { bg: 'bg-amber-50', icon: 'text-amber-700', badge: 'bg-amber-600' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-700', badge: 'bg-blue-600' },
  red: { bg: 'bg-red-50', icon: 'text-red-700', badge: 'bg-red-600' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-700', badge: 'bg-orange-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-700', badge: 'bg-purple-600' },
}

export function StatCard({ title, value, subtitle, icon, color = 'green', trend }: StatCardProps) {
  const colors = colorMap[color]
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
          {trend && (
            <span className={`inline-flex items-center gap-1 text-xs font-medium mt-2 px-2 py-0.5 rounded-full ${trend.value >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </span>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colors.bg}`}>
          <div className={`w-6 h-6 ${colors.icon}`}>{icon}</div>
        </div>
      </div>
    </Card>
  )
}
