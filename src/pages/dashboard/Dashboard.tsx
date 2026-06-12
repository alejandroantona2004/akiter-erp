import {
  Users, FileText, Briefcase, Receipt,
  TrendingUp, Clock, CheckCircle, AlertTriangle,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { StatCard } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { useAuthStore } from '../../store/authStore'
import { ROLE_LABELS } from '../../types'
import { useCrud } from '../../hooks/useCrud'

const statusColors = {
  info: 'blue' as const,
  success: 'green' as const,
  warning: 'gold' as const,
  error: 'red' as const,
}

const pendingTasks = [
  { id: 1, title: 'Revisar presupuestos pendientes de firma', priority: 'alta', due: 'Hoy', path: '/presupuestos' },
  { id: 2, title: 'Actualizar partes de trabajo sin firmar', priority: 'media', due: 'Esta semana', path: '/partes-trabajo' },
  { id: 3, title: 'Verificar facturas próximas a vencer', priority: 'baja', due: 'Esta semana', path: '/facturacion' },
]

export function Dashboard() {
  const { user, hasPermission } = useAuthStore()
  const navigate = useNavigate()

  const currentMonth = new Date().toISOString().slice(0, 7)

  const { data: clientes } = useCrud<{ id: string; estado: string }>(
    'akiter_clientes', { select: 'id,estado', eq: [['estado', 'activo']] }
  )
  const { data: presupuestosPendientes } = useCrud<{ id: string }>(
    'akiter_presupuestos', { select: 'id', eq: [['estado', 'enviado']] }
  )
  const { data: proyectosActivos } = useCrud<{ id: string }>(
    'akiter_proyectos', { select: 'id', eq: [['estado', 'en_curso']] }
  )
  const { data: facturas } = useCrud<{ id: string; total: number; fecha_emision: string; estado: string }>(
    'akiter_facturas', { select: 'id,total,fecha_emision,estado' }
  )
  const { data: partesPendientes } = useCrud<{ id: string }>(
    'akiter_partes_trabajo', { select: 'id', eq: [['estado', 'pendiente_firma']] }
  )

  const facturacionMes = facturas
    .filter(f => f.fecha_emision?.startsWith(currentMonth) && f.estado !== 'borrador')
    .reduce((s, f) => s + Number(f.total ?? 0), 0)

  const recentFacturas = [...facturas]
    .sort((a, b) => b.fecha_emision?.localeCompare(a.fecha_emision ?? '') ?? 0)
    .slice(0, 3)

  const fmtEuro = (v: number) =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k €` : `${v.toFixed(0)} €`

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            Bienvenido, {user?.nombre || 'Usuario'}
          </h2>
          <p className="text-gray-500 mt-1">
            {user && ROLE_LABELS[user.rol]} · {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {(hasPermission('clientes') || hasPermission('crm')) && (
          <StatCard
            title="Clientes activos"
            value={clientes.length.toString()}
            icon={<Users size={22} />}
            color="green"
            onClick={() => navigate('/crm')}
          />
        )}
        {hasPermission('presupuestos') && (
          <StatCard
            title="Presupuestos enviados"
            value={presupuestosPendientes.length.toString()}
            subtitle="Pendientes de firma"
            icon={<FileText size={22} />}
            color="gold"
            onClick={() => navigate('/presupuestos')}
          />
        )}
        {hasPermission('proyectos') && (
          <StatCard
            title="Proyectos en curso"
            value={proyectosActivos.length.toString()}
            icon={<Briefcase size={22} />}
            color="blue"
            onClick={() => navigate('/proyectos')}
          />
        )}
        {(hasPermission('facturacion') || hasPermission('cobros')) && (
          <StatCard
            title={`Facturación ${new Date().toLocaleString('es-ES', { month: 'long' })}`}
            value={fmtEuro(facturacionMes)}
            icon={<Receipt size={22} />}
            color="purple"
            onClick={() => navigate('/facturacion')}
          />
        )}
        {hasPermission('partes_trabajo') && !hasPermission('clientes') && (
          <StatCard
            title="Partes pendientes"
            value={partesPendientes.length.toString()}
            subtitle="Sin firmar"
            icon={<Clock size={22} />}
            color="orange"
            onClick={() => navigate('/partes-trabajo')}
          />
        )}
        {hasPermission('proyectos') && !hasPermission('clientes') && (
          <StatCard
            title="Proyectos en curso"
            value={proyectosActivos.length.toString()}
            icon={<Briefcase size={22} />}
            color="blue"
            onClick={() => navigate('/proyectos')}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent invoices / activity */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">
              {hasPermission('facturacion') ? 'Facturas recientes' : 'Actividad reciente'}
            </h3>
          </div>
          {hasPermission('facturacion') && recentFacturas.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {recentFacturas.map(f => (
                <div key={f.id} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate('/facturacion')}>
                  <div className="w-8 h-8 rounded-full bg-[#f0f7f3] flex items-center justify-center flex-shrink-0">
                    <Receipt size={14} className="text-[#1a4a2e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">Factura emitida</p>
                    <p className="text-xs text-gray-400 mt-0.5">{f.fecha_emision}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{Number(f.total ?? 0).toLocaleString('es-ES')} €</p>
                    <Badge variant={f.estado === 'cobrada' ? 'green' : f.estado === 'vencida' ? 'red' : f.estado === 'emitida' ? 'blue' : 'gray'}>
                      {f.estado}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {[
                { id: 1, desc: 'Sistema Akiter ERP iniciado', time: 'Hoy', status: 'success' },
                { id: 2, desc: 'Acceso correcto con tu cuenta', time: 'Ahora mismo', status: 'info' },
                { id: 3, desc: 'Datos sincronizados con Supabase', time: 'Hoy', status: 'success' },
              ].map(item => (
                <div key={item.id} className="flex items-start gap-4 p-4 hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-[#f0f7f3] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp size={14} className="text-[#1a4a2e]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{item.desc}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                  </div>
                  <Badge variant={statusColors[item.status as keyof typeof statusColors]}>
                    {item.status === 'success' ? 'OK' : 'Info'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending tasks */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Tareas pendientes</h3>
            <Badge variant="gold">{pendingTasks.length}</Badge>
          </div>
          <div className="p-4 space-y-3">
            {pendingTasks.map(task => (
              <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-[#1a4a2e]/30 transition-colors cursor-pointer" onClick={() => navigate(task.path)}>
                <div className="mt-0.5">
                  {task.priority === 'alta' ? (
                    <AlertTriangle size={14} className="text-red-500" />
                  ) : task.priority === 'media' ? (
                    <Clock size={14} className="text-amber-500" />
                  ) : (
                    <CheckCircle size={14} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-tight">{task.title}</p>
                  <p className="text-xs text-gray-400 mt-1">Vence: {task.due}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
