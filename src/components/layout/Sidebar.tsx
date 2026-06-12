import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Building2, Award,
  Briefcase, ClipboardList, Package, Receipt, Wallet,
  Truck, FolderOpen, LogOut, ChevronLeft, ChevronRight, X, MessageSquare,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { ROLE_LABELS } from '../../types'
import logoImg from '../../assets/Akiter-logo.png.png'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  permission: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={18} />, permission: '*' },
  // Comercial
  { label: 'CRM', path: '/crm', icon: <Users size={18} />, permission: 'crm' },
  { label: 'Presupuestos', path: '/presupuestos', icon: <FileText size={18} />, permission: 'presupuestos' },
  { label: 'Clientes', path: '/clientes', icon: <Building2 size={18} />, permission: 'clientes' },
  { label: 'Subvenciones', path: '/subvenciones', icon: <Award size={18} />, permission: 'subvenciones' },
  // Técnico
  { label: 'Proyectos', path: '/proyectos', icon: <Briefcase size={18} />, permission: 'proyectos' },
  { label: 'Partes de Trabajo', path: '/partes-trabajo', icon: <ClipboardList size={18} />, permission: 'partes_trabajo' },
  { label: 'Inventario', path: '/inventario', icon: <Package size={18} />, permission: 'inventario_read' },
  // Administrativo
  { label: 'Facturación', path: '/facturacion', icon: <Receipt size={18} />, permission: 'facturacion' },
  { label: 'Cobros', path: '/cobros', icon: <Wallet size={18} />, permission: 'cobros' },
  { label: 'Proveedores', path: '/proveedores', icon: <Truck size={18} />, permission: 'proveedores' },
  // Subcontratista
  { label: 'Mis Órdenes', path: '/mis-ordenes', icon: <FolderOpen size={18} />, permission: 'mis_ordenes' },
  // Asistente IA — todos los roles
  { label: 'Asistente IA', path: '/asistente', icon: <MessageSquare size={18} />, permission: '*' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { user, signOut, hasPermission } = useAuthStore()
  const visibleItems = NAV_ITEMS.filter(
    (item) => item.permission === '*' || hasPermission(item.permission)
  )

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0f2e1c]">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? 'justify-center' : ''}`}>
        <img src={logoImg} alt="Akiter" className="w-8 h-8 object-contain flex-shrink-0" />
        {!collapsed && (
          <div>
            <p className="text-white font-bold text-sm leading-tight">Akiter</p>
            <p className="text-[#c9a84c] text-xs">ERP</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onMobileClose}
            className={({ isActive }) => `
              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${isActive
                ? 'bg-[#c9a84c] text-white'
                : 'text-white/70 hover:text-white hover:bg-white/10'
              }
              ${collapsed ? 'justify-center' : ''}
            `}
            title={collapsed ? item.label : undefined}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-white/10 p-3">
        {user && (
          <div className={`flex items-center gap-3 mb-2 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-8 h-8 rounded-full bg-[#c9a84c] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user.nombre?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </span>
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-white text-xs font-medium truncate">{user.nombre || user.email}</p>
                <p className="text-[#c9a84c] text-xs">{ROLE_LABELS[user.rol]}</p>
              </div>
            )}
          </div>
        )}
        <button
          onClick={signOut}
          className={`
            flex items-center gap-2 w-full px-3 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10
            text-sm transition-colors cursor-pointer
            ${collapsed ? 'justify-center' : ''}
          `}
          title={collapsed ? 'Cerrar sesión' : undefined}
        >
          <LogOut size={16} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'} flex-shrink-0 relative`}>
        {sidebarContent}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-6 w-6 h-6 bg-[#1a4a2e] border border-white/20 rounded-full flex items-center justify-center text-white/70 hover:text-white cursor-pointer z-10"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={onMobileClose} />
          <aside className="relative w-56 flex flex-col">
            {sidebarContent}
            <button
              onClick={onMobileClose}
              className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </aside>
        </div>
      )}
    </>
  )
}
