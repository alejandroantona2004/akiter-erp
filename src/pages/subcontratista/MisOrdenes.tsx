import { useState } from 'react'
import { Plus, Search, MapPin, Calendar, Clock, FileText, CheckCircle, Pencil, Trash2, Play } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { OrdenTrabajoForm, type OrdenTrabajoData } from '../../components/forms/OrdenTrabajoForm'
import { useCrud } from '../../hooks/useCrud'
import { useAuthStore } from '../../store/authStore'

interface OrdenTrabajo extends OrdenTrabajoData {
  id: string
  created_at: string
  akiter_proyectos?: { nombre: string; codigo: string }
  akiter_usuarios?: { nombre: string; apellidos: string; email: string }
}

const estadoConfig = {
  asignada:   { label: 'Asignada',   color: 'blue' as const },
  en_curso:   { label: 'En curso',   color: 'green' as const },
  completada: { label: 'Completada', color: 'gold' as const },
  firmada:    { label: 'Firmada',    color: 'gray' as const },
}

export function MisOrdenes() {
  const { user, hasPermission } = useAuthStore()
  const isSubcontratista = user?.rol === 'subcontratista'
  const canManage = hasPermission('*') || hasPermission('proyectos')

  const crudOptions = {
    orderBy: 'created_at', orderAsc: false,
    select: '*, akiter_proyectos(nombre,codigo), akiter_usuarios!akiter_ordenes_trabajo_subcontratista_id_fkey(nombre,apellidos,email)',
    ...(isSubcontratista && user?.id ? { eq: [['subcontratista_id', user.id]] as [string, unknown][] } : {}),
  }

  const { data: ordenes, loading, create, update, remove } = useCrud<OrdenTrabajo>('akiter_ordenes_trabajo', crudOptions)

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<OrdenTrabajo | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrdenTrabajo | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = ordenes.filter(o =>
    o.numero.toLowerCase().includes(search.toLowerCase()) ||
    o.akiter_proyectos?.nombre.toLowerCase().includes(search.toLowerCase()) ||
    o.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
    o.localidad?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (o: OrdenTrabajo) => { setEditing(o); setFormOpen(true) }

  const handleSave = async (data: Omit<OrdenTrabajoData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<OrdenTrabajo, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const changeEstado = (id: string, estado: string) => update(id, { estado } as Partial<OrdenTrabajo>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {isSubcontratista ? 'Mis Órdenes de Trabajo' : 'Órdenes de Trabajo'}
          </h2>
          <p className="text-sm text-gray-500">
            {isSubcontratista
              ? `Bienvenido, ${user?.nombre || 'Subcontratista'} · `
              : ''}
            {ordenes.length} órdenes asignadas
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate}><Plus size={16} /> Nueva orden</Button>
        )}
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(estadoConfig).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <Badge variant={cfg.color}>{cfg.label}</Badge>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {ordenes.filter(o => o.estado === key).length}
            </p>
          </div>
        ))}
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar órdenes..." value={search}
          onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
              <div className="h-5 bg-gray-200 rounded w-64 mb-2" />
              <div className="h-4 bg-gray-200 rounded w-48" />
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No hay órdenes de trabajo</p>
          {canManage && <p className="text-sm mt-1">Crea la primera orden con el botón de arriba</p>}
        </div>
      )}

      <div className="space-y-4">
        {filtered.map(orden => {
          const cfg = estadoConfig[orden.estado as keyof typeof estadoConfig] ?? { label: orden.estado, color: 'gray' as const }
          const tecnico = orden.akiter_usuarios
            ? `${orden.akiter_usuarios.nombre ?? ''} ${orden.akiter_usuarios.apellidos ?? ''}`.trim() || orden.akiter_usuarios.email
            : null

          return (
            <div key={orden.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-[#1a4a2e]/30 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-gray-400">{orden.numero}</span>
                    <Badge variant={cfg.color}>{cfg.label}</Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 mt-1">
                    {orden.akiter_proyectos
                      ? `${orden.akiter_proyectos.codigo} — ${orden.akiter_proyectos.nombre}`
                      : 'Sin proyecto asignado'}
                  </h3>
                  {orden.descripcion && <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{orden.descripcion}</p>}
                </div>

                {canManage && (
                  <div className="flex gap-1 ml-3 flex-shrink-0">
                    <button onClick={() => openEdit(orden)}
                      className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer" title="Editar">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDeleteTarget(orden)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer" title="Eliminar">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                {orden.localidad && <div className="flex items-center gap-1.5"><MapPin size={13} />{orden.localidad}</div>}
                {(orden.fecha_inicio || orden.fecha_fin) && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} />
                    {orden.fecha_inicio ?? '—'}{orden.fecha_fin ? ` → ${orden.fecha_fin}` : ''}
                  </div>
                )}
                {orden.horas_estimadas && <div className="flex items-center gap-1.5"><Clock size={13} />{orden.horas_estimadas}h estimadas</div>}
                {tecnico && !isSubcontratista && (
                  <div className="flex items-center gap-1.5 text-[#1a4a2e] font-medium">{tecnico}</div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap">
                {orden.estado === 'asignada' && (
                  <Button size="sm" onClick={() => changeEstado(orden.id, 'en_curso')}>
                    <Play size={13} /> Comenzar
                  </Button>
                )}
                {orden.estado === 'en_curso' && (
                  <Button size="sm" variant="secondary" onClick={() => changeEstado(orden.id, 'completada')}>
                    <CheckCircle size={13} /> Completar
                  </Button>
                )}
                {orden.estado === 'completada' && canManage && (
                  <Button size="sm" variant="secondary" onClick={() => changeEstado(orden.id, 'firmada')}>
                    <CheckCircle size={13} /> Marcar firmada
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <OrdenTrabajoForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar orden de trabajo"
        message={`¿Eliminar la orden "${deleteTarget?.numero}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
