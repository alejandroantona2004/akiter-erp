import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/crm': 'CRM',
  '/presupuestos': 'Presupuestos',
  '/clientes': 'Clientes',
  '/subvenciones': 'Subvenciones',
  '/proyectos': 'Proyectos',
  '/partes-trabajo': 'Partes de Trabajo',
  '/inventario': 'Inventario',
  '/facturacion': 'Facturación',
  '/cobros': 'Cobros',
  '/proveedores': 'Proveedores',
  '/mis-ordenes': 'Mis Órdenes',
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] || 'Akiter ERP'

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header onMobileMenuOpen={() => setMobileOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
