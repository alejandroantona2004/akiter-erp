import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { Login } from './pages/auth/Login'
import { Dashboard } from './pages/dashboard/Dashboard'
import { CRM } from './pages/comercial/CRM'
import { Presupuestos } from './pages/comercial/Presupuestos'
import { Clientes } from './pages/comercial/Clientes'
import { Subvenciones } from './pages/comercial/Subvenciones'
import { Proyectos } from './pages/tecnico/Proyectos'
import { PartesTrabajoTecnico } from './pages/tecnico/PartesTrabajoTecnico'
import { Inventario } from './pages/tecnico/Inventario'
import { Facturacion } from './pages/administrativo/Facturacion'
import { Cobros } from './pages/administrativo/Cobros'
import { Proveedores } from './pages/administrativo/Proveedores'
import { MisOrdenes } from './pages/subcontratista/MisOrdenes'
import { AsistenteIA } from './pages/asistente/AsistenteIA'
import { useAuthStore } from './store/authStore'

export default function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />

          {/* Comercial */}
          <Route path="crm" element={<ProtectedRoute permission="crm"><CRM /></ProtectedRoute>} />
          <Route path="presupuestos" element={<ProtectedRoute permission="presupuestos"><Presupuestos /></ProtectedRoute>} />
          <Route path="clientes" element={<ProtectedRoute permission="clientes"><Clientes /></ProtectedRoute>} />
          <Route path="subvenciones" element={<ProtectedRoute permission="subvenciones"><Subvenciones /></ProtectedRoute>} />

          {/* Técnico */}
          <Route path="proyectos" element={<ProtectedRoute permission="proyectos"><Proyectos /></ProtectedRoute>} />
          <Route path="partes-trabajo" element={<ProtectedRoute permission="partes_trabajo"><PartesTrabajoTecnico /></ProtectedRoute>} />
          <Route path="inventario" element={<ProtectedRoute permission="inventario_read"><Inventario /></ProtectedRoute>} />

          {/* Administrativo */}
          <Route path="facturacion" element={<ProtectedRoute permission="facturacion"><Facturacion /></ProtectedRoute>} />
          <Route path="cobros" element={<ProtectedRoute permission="cobros"><Cobros /></ProtectedRoute>} />
          <Route path="proveedores" element={<ProtectedRoute permission="proveedores"><Proveedores /></ProtectedRoute>} />

          {/* Subcontratista */}
          <Route path="mis-ordenes" element={<ProtectedRoute permission="mis_ordenes"><MisOrdenes /></ProtectedRoute>} />

          {/* Asistente IA — accesible a todos los roles */}
          <Route path="asistente" element={<AsistenteIA />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
