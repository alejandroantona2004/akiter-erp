import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, Euro, Calendar } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { SubvencionForm, type SubvencionData } from '../../components/forms/SubvencionForm'
import { useCrud } from '../../hooks/useCrud'

interface Subvencion extends SubvencionData {
  id: string
  created_at: string
  akiter_clientes?: { nombre: string }
}

const estadoConfig = {
  identificada: { label: 'Identificada', color: 'gray' as const },
  solicitada:   { label: 'Solicitada',   color: 'blue' as const },
  en_tramite:   { label: 'En trámite',   color: 'gold' as const },
  aprobada:     { label: 'Aprobada',     color: 'green' as const },
  denegada:     { label: 'Denegada',     color: 'red' as const },
  cobrada:      { label: 'Cobrada',      color: 'purple' as const },
}

export function Subvenciones() {
  const { data: subvenciones, loading, create, update, remove } = useCrud<Subvencion>('akiter_subvenciones', {
    orderBy: 'created_at', orderAsc: false,
    select: '*, akiter_clientes(nombre)',
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Subvencion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subvencion | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = subvenciones.filter(s =>
    s.nombre.toLowerCase().includes(search.toLowerCase()) ||
    s.organismo?.toLowerCase().includes(search.toLowerCase()) ||
    s.akiter_clientes?.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const totalAprobado = subvenciones
    .filter(s => ['aprobada', 'cobrada'].includes(s.estado))
    .reduce((sum, s) => sum + Number(s.importe ?? 0), 0)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (s: Subvencion) => { setEditing(s); setFormOpen(true) }

  const handleSave = async (data: Omit<SubvencionData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Subvencion, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const changeEstado = (id: string, estado: string) => update(id, { estado } as Partial<Subvencion>)

  const columns = [
    { key: 'nombre', header: 'Subvención',
      render: (s: Subvencion) => (
        <div>
          <p className="font-medium text-gray-900">{s.nombre}</p>
          <p className="text-xs text-gray-400">{s.organismo || '—'}</p>
        </div>
      ) },
    { key: 'cliente', header: 'Cliente',
      render: (s: Subvencion) => <span className="text-gray-600">{s.akiter_clientes?.nombre ?? '—'}</span> },
    { key: 'importe', header: 'Importe',
      render: (s: Subvencion) => s.importe
        ? <span className="font-semibold text-[#1a4a2e]">{Number(s.importe).toLocaleString('es-ES')} €</span>
        : <span className="text-gray-400">—</span> },
    { key: 'fecha_solicitud', header: 'Solicitud',
      render: (s: Subvencion) => <span className="text-gray-500 text-sm">{s.fecha_solicitud || '—'}</span> },
    { key: 'estado', header: 'Estado',
      render: (s: Subvencion) => {
        const cfg = estadoConfig[s.estado as keyof typeof estadoConfig]
        return cfg ? <Badge variant={cfg.color}>{cfg.label}</Badge> : <Badge>{s.estado}</Badge>
      } },
    { key: 'acciones', header: '',
      render: (s: Subvencion) => (
        <div className="flex gap-1 justify-end">
          {s.estado === 'identificada' && (
            <button onClick={e => { e.stopPropagation(); changeEstado(s.id, 'solicitada') }}
              className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 cursor-pointer">
              Solicitar
            </button>
          )}
          {s.estado === 'solicitada' && (
            <button onClick={e => { e.stopPropagation(); changeEstado(s.id, 'en_tramite') }}
              className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 cursor-pointer">
              En trámite
            </button>
          )}
          {s.estado === 'en_tramite' && (
            <button onClick={e => { e.stopPropagation(); changeEstado(s.id, 'aprobada') }}
              className="text-xs px-2 py-1 rounded bg-green-50 text-green-700 hover:bg-green-100 cursor-pointer">
              Aprobar
            </button>
          )}
          {s.estado === 'aprobada' && (
            <button onClick={e => { e.stopPropagation(); changeEstado(s.id, 'cobrada') }}
              className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 cursor-pointer">
              Cobrada
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); openEdit(s) }}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer">
            <Pencil size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(s) }}
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer">
            <Trash2 size={13} />
          </button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Subvenciones</h2>
          <p className="text-sm text-gray-500">{subvenciones.length} subvenciones gestionadas</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nueva subvención</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg"><Euro size={18} className="text-green-700" /></div>
            <div>
              <p className="text-xs text-gray-500">Aprobado / Cobrado</p>
              <p className="text-xl font-bold text-green-700">{totalAprobado.toLocaleString('es-ES')} €</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg"><Calendar size={18} className="text-blue-700" /></div>
            <div>
              <p className="text-xs text-gray-500">En trámite</p>
              <p className="text-xl font-bold text-blue-700">
                {subvenciones.filter(s => ['solicitada', 'en_tramite'].includes(s.estado)).length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg"><Search size={18} className="text-amber-700" /></div>
            <div>
              <p className="text-xs text-gray-500">Identificadas</p>
              <p className="text-xl font-bold text-amber-700">
                {subvenciones.filter(s => s.estado === 'identificada').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar subvenciones..." value={search}
          onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table columns={columns} data={filtered} keyExtractor={s => s.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay subvenciones registradas'} loading={loading} />

      <SubvencionForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar subvención"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
