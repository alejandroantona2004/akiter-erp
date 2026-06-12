import { Menu, Bell, Search } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { ROLE_LABELS, ROLE_COLORS } from '../../types'

interface HeaderProps {
  onMobileMenuOpen: () => void
  title: string
}

export function Header({ onMobileMenuOpen, title }: HeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center gap-4 px-4 flex-shrink-0">
      <button
        onClick={onMobileMenuOpen}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer"
      >
        <Menu size={20} />
      </button>

      <h1 className="text-lg font-semibold text-gray-900 hidden sm:block">{title}</h1>

      <div className="flex-1" />

      {/* Search (desktop) */}
      <div className="hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-400 w-48">
        <Search size={14} />
        <span>Buscar...</span>
      </div>

      {/* Notifications */}
      <button className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer">
        <Bell size={18} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#c9a84c] rounded-full" />
      </button>

      {/* User chip */}
      {user && (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1a4a2e] flex items-center justify-center">
            <span className="text-white text-xs font-bold">
              {user.nombre?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">
              {user.nombre || user.email}
            </p>
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${ROLE_COLORS[user.rol]}`}>
              {ROLE_LABELS[user.rol]}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
