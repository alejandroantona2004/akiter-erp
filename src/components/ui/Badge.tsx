import { type ReactNode } from 'react'

interface BadgeProps {
  children: ReactNode
  variant?: 'green' | 'gold' | 'blue' | 'red' | 'orange' | 'gray' | 'purple'
  size?: 'sm' | 'md'
}

const variants = {
  green: 'bg-green-100 text-green-800',
  gold: 'bg-amber-100 text-amber-800',
  blue: 'bg-blue-100 text-blue-800',
  red: 'bg-red-100 text-red-800',
  orange: 'bg-orange-100 text-orange-800',
  gray: 'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
}

export function Badge({ children, variant = 'gray', size = 'sm' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  )
}
