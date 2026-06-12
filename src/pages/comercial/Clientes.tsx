import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, Building2, Phone, Mail, MapPin } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ClienteForm, type ClienteData } from '../../components/forms/ClienteForm'
import { useCrud } from '../../hooks/useCrud'

interface Cliente extends ClienteData {
  id: string
  created_at: string
}

const estadoColor = { activo: 'green' as const, inactivo: 'gray' as const, potencial: 'gold' as const }
const estadoLabel = { activo: 'Activo', inactivo: 'Inactivo', potencial: 'Potencial' }

export function Clientes() {
  const { data: clientes, loading, create, update, remove } = useCrud<Cliente>('akiter_clientes', {
    orderBy: 'nombre', orderAsc: true,
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [detail, setDetail] = useState<Cliente | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cliente | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.localidad?.toLowerCase().includes(search.toLowerCase()) ||
    c.cif?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (c: Cliente) => { setEditing(c); setFormOpen(true) }

  const handleSave = async (data: Omit<ClienteData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Cliente, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
    if (detail?.id === deleteTarget.id) setDetail(null)
  }

  const columns = [
    {
      key: 'nombre', header: 'Empresa',
      render: (c: Cliente) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f0f7f3] flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-[#1a4a2e]" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{c.nombre}</p>
            <p className="text-xs text-gray-400">{c.cif}</p>
          </div>
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (c: Cliente) => <span className="text-gray-600">{c.email}</span> },
    { key: 'telefono', header: 'Teléfono', render: (c: Cliente) => <span className="text-gray-600">{c.telefono}</span> },
    { key: 'localidad', header: 'Localidad', render: (c: Cliente) => <span className="text-gray-600">{c.localidad}</span> },
    {
      key: 'estado', header: 'Estado',
      render: (c: Cliente) => <Badge variant={estadoColor[c.estado as keyof typeof estadoColor] ?? 'gray'}>{estadoLabel[c.estado as keyof typeof estadoLabel] ?? c.estado}</Badge>,
    },
    {
      key: 'acciones', header: '',
      render: (c: Cliente) => (
        <div className="flex gap-1 justify-end">
          <button onClick={e => { e.stopPropagation(); openEdit(c) }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"><Pencil size={14} /></button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(c) }} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">{clientes.length} clientes registrados</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo cliente</Button>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar clientes..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table
        columns={columns}
        data={filtered}
        keyExtractor={c => c.id}
        emptyMessage={loading ? 'Cargando...' : 'No se encontraron clientes'}
        loading={loading}
        onRowClick={setDetail}
      />

      {/* Detail modal */}
      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail?.nombre ?? ''} size="md"
        footer={<>
          <Button variant="ghost" onClick={() => setDetail(null)}>Cerrar</Button>
          <Button variant="secondary" onClick={() => { openEdit(detail!); setDetail(null) }}><Pencil size={14} /> Editar</Button>
        </>}
      >
        {detail && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="text-xs text-gray-500">CIF</p><p className="font-medium">{detail.cif || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Estado</p><Badge variant={estadoColor[detail.estado as keyof typeof estadoColor] ?? 'gray'}>{estadoLabel[detail.estado as keyof typeof estadoLabel]}</Badge></div>
            </div>
            {detail.email && <div className="flex items-center gap-2 text-sm text-gray-700"><Mail size={14} className="text-gray-400" />{detail.email}</div>}
            {detail.telefono && <div className="flex items-center gap-2 text-sm text-gray-700"><Phone size={14} className="text-gray-400" />{detail.telefono}</div>}
            {(detail.localidad || detail.provincia) && (
              <div className="flex items-center gap-2 text-sm text-gray-700"><MapPin size={14} className="text-gray-400" />{[detail.localidad, detail.provincia].filter(Boolean).join(', ')}</div>
            )}
            {detail.direccion && <p className="text-sm text-gray-600">{detail.direccion}</p>}
            {detail.notas && <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">{detail.notas}</div>}
          </div>
        )}
      </Modal>

      <ClienteForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar cliente"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
