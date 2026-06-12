import { useState } from 'react'
import { Plus, Search, MapPin, Calendar, Users, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ProyectoForm, type ProyectoData } from '../../components/forms/ProyectoForm'
import { useCrud } from '../../hooks/useCrud'

interface Proyecto extends ProyectoData {
  id: string
  created_at: string
  akiter_clientes?: { nombre: string }
}

const estadoConfig = {
  planificacion: { label: 'Planificación', color: 'blue' as const },
  en_curso:      { label: 'En curso',      color: 'green' as const },
  pausado:       { label: 'Pausado',       color: 'gold' as const },
  finalizado:    { label: 'Finalizado',    color: 'gray' as const },
  cancelado:     { label: 'Cancelado',     color: 'red' as const },
}

const progressColor = (p: number) =>
  p === 100 ? 'bg-gray-400' : p >= 60 ? 'bg-[#1a4a2e]' : p >= 30 ? 'bg-[#c9a84c]' : 'bg-blue-500'

export function Proyectos() {
  const { data: proyectos, loading, create, update, remove } = useCrud<Proyecto>('akiter_proyectos', {
    orderBy: 'created_at', orderAsc: false,
    select: '*, akiter_clientes(nombre)',
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Proyecto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proyecto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = proyectos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    p.localidad?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: Proyecto) => { setEditing(p); setFormOpen(true) }

  const handleSave = async (data: Omit<ProyectoData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Proyecto, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Proyectos</h2>
          <p className="text-sm text-gray-500">
            {proyectos.filter(p => p.estado === 'en_curso').length} en curso · {proyectos.length} totales
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo proyecto</Button>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar proyectos..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#1a4a2e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">No se encontraron proyectos</div>
          )}
          {filtered.map(proy => {
            const cfg = estadoConfig[proy.estado as keyof typeof estadoConfig] ?? { label: proy.estado, color: 'gray' as const }
            const progreso = proy.progreso ?? 0
            return (
              <div key={proy.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400 font-mono">{proy.codigo}</p>
                    <h3 className="font-semibold text-gray-900 mt-0.5 truncate">{proy.nombre}</h3>
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <Badge variant={cfg.color}>{cfg.label}</Badge>
                    <button onClick={() => openEdit(proy)} className="p-1.5 rounded text-gray-300 hover:text-gray-600 cursor-pointer"><Pencil size={13} /></button>
                    <button onClick={() => setDeleteTarget(proy)} className="p-1.5 rounded text-gray-300 hover:text-red-500 cursor-pointer"><Trash2 size={13} /></button>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4">
                  {(proy.akiter_clientes?.nombre || proy.cliente_id) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Users size={13} />{proy.akiter_clientes?.nombre ?? '—'}</div>
                  )}
                  {proy.localidad && <div className="flex items-center gap-2 text-sm text-gray-500"><MapPin size={13} />{proy.localidad}</div>}
                  {(proy.fecha_inicio || proy.fecha_fin) && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar size={13} />{proy.fecha_inicio ?? '—'} → {proy.fecha_fin ?? '—'}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Progreso</span>
                    <span className="font-medium text-gray-700">{progreso}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${progressColor(progreso)}`} style={{ width: `${progreso}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <span className="text-sm font-semibold text-[#1a4a2e]">
                    {proy.presupuesto ? `${Number(proy.presupuesto).toLocaleString('es-ES')} €` : '—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ProyectoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar proyecto"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
