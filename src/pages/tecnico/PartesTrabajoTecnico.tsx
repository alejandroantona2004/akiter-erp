import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, CheckCircle, Clock, FileSignature } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ParteTrabajoForm, type ParteTrabajoData } from '../../components/forms/ParteTrabajoForm'
import { useCrud } from '../../hooks/useCrud'

interface Parte extends ParteTrabajoData {
  id: string
  created_at: string
  akiter_proyectos?: { nombre: string; codigo: string }
  akiter_usuarios?: { nombre: string; apellidos: string }
}

const estadoConfig = {
  borrador:        { label: 'Borrador',       color: 'gray' as const,   icon: Clock },
  pendiente_firma: { label: 'Pdte. firma',    color: 'gold' as const,   icon: FileSignature },
  firmado:         { label: 'Firmado',        color: 'green' as const,  icon: CheckCircle },
  facturado:       { label: 'Facturado',      color: 'blue' as const,   icon: CheckCircle },
}

export function PartesTrabajoTecnico() {
  const { data: partes, loading, create, update, remove } = useCrud<Parte>('akiter_partes_trabajo', {
    orderBy: 'fecha', orderAsc: false,
    select: '*, akiter_proyectos(nombre,codigo), akiter_usuarios!akiter_partes_trabajo_tecnico_id_fkey(nombre,apellidos)',
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Parte | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Parte | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = partes.filter(p =>
    p.numero.toLowerCase().includes(search.toLowerCase()) ||
    p.akiter_proyectos?.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(search.toLowerCase())
  )

  const totalHoras = filtered.reduce((s, p) => s + Number(p.horas ?? 0), 0)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: Parte) => { setEditing(p); setFormOpen(true) }

  const handleSave = async (data: Omit<ParteTrabajoData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Parte, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const columns = [
    { key: 'numero', header: 'Número',
      render: (p: Parte) => <span className="font-mono text-sm font-medium text-gray-900">{p.numero}</span> },
    { key: 'proyecto', header: 'Proyecto',
      render: (p: Parte) => p.akiter_proyectos
        ? <div><p className="text-gray-800 font-medium">{p.akiter_proyectos.nombre}</p><p className="text-xs text-gray-400">{p.akiter_proyectos.codigo}</p></div>
        : <span className="text-gray-400">—</span> },
    { key: 'tecnico', header: 'Técnico',
      render: (p: Parte) => p.akiter_usuarios
        ? <span className="text-gray-700">{`${p.akiter_usuarios.nombre ?? ''} ${p.akiter_usuarios.apellidos ?? ''}`.trim()}</span>
        : <span className="text-gray-400">—</span> },
    { key: 'fecha', header: 'Fecha',
      render: (p: Parte) => <span className="text-gray-500 text-sm">{p.fecha}</span> },
    { key: 'horas', header: 'Horas',
      render: (p: Parte) => <span className="font-semibold text-gray-900">{p.horas}h</span> },
    { key: 'descripcion', header: 'Descripción',
      render: (p: Parte) => <span className="text-gray-500 text-sm line-clamp-1">{p.descripcion}</span> },
    { key: 'estado', header: 'Estado',
      render: (p: Parte) => {
        const cfg = estadoConfig[p.estado as keyof typeof estadoConfig]
        return cfg ? <Badge variant={cfg.color}>{cfg.label}</Badge> : <Badge>{p.estado}</Badge>
      } },
    { key: 'acciones', header: '',
      render: (p: Parte) => (
        <div className="flex gap-1 justify-end">
          {p.estado === 'borrador' && (
            <button onClick={e => { e.stopPropagation(); update(p.id, { estado: 'pendiente_firma' }) }}
              className="p-1.5 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer" title="Enviar a firma">
              <FileSignature size={13} />
            </button>
          )}
          {p.estado === 'pendiente_firma' && (
            <button onClick={e => { e.stopPropagation(); update(p.id, { estado: 'firmado' }) }}
              className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 cursor-pointer" title="Marcar firmado">
              <CheckCircle size={13} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); openEdit(p) }}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"><Pencil size={13} /></button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 size={13} /></button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Partes de Trabajo</h2>
          <p className="text-sm text-gray-500">{partes.length} partes · {totalHoras}h totales</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo parte</Button>
      </div>

      {/* Estado summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(estadoConfig).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <Badge variant={cfg.color}>{cfg.label}</Badge>
            <p className="text-2xl font-bold text-gray-900 mt-2">{partes.filter(p => p.estado === key).length}</p>
          </div>
        ))}
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar partes..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table columns={columns} data={filtered} keyExtractor={p => p.id}
        emptyMessage={loading ? 'Cargando...' : 'No se encontraron partes de trabajo'} loading={loading} />

      <ParteTrabajoForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar parte de trabajo"
        message={`¿Eliminar el parte "${deleteTarget?.numero}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
