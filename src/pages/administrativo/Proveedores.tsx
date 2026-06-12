import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, Mail, Phone, Building2 } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ProveedorForm, type ProveedorData } from '../../components/forms/ProveedorForm'
import { useCrud } from '../../hooks/useCrud'

interface Proveedor extends ProveedorData {
  id: string
  created_at: string
}

export function Proveedores() {
  const { data: proveedores, loading, create, update, remove } = useCrud<Proveedor>('akiter_proveedores', {
    orderBy: 'nombre', orderAsc: true,
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [detail, setDetail] = useState<Proveedor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Proveedor | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.categoria?.toLowerCase().includes(search.toLowerCase()) ||
    p.localidad?.toLowerCase().includes(search.toLowerCase()) ||
    p.contacto?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: Proveedor) => { setEditing(p); setFormOpen(true) }

  const handleSave = async (data: Omit<ProveedorData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>)
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
    { key: 'nombre', header: 'Proveedor',
      render: (p: Proveedor) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#f0f7f3] flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-[#1a4a2e]" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{p.nombre}</p>
            <p className="text-xs text-gray-400">{p.cif}</p>
          </div>
        </div>
      ) },
    { key: 'categoria', header: 'Categoría',
      render: (p: Proveedor) => p.categoria ? <Badge variant="blue">{p.categoria}</Badge> : null },
    { key: 'contacto', header: 'Contacto',
      render: (p: Proveedor) => <span className="text-gray-600">{p.contacto}</span> },
    { key: 'telefono', header: 'Teléfono',
      render: (p: Proveedor) => p.telefono
        ? <a href={`tel:${p.telefono}`} className="text-gray-600 hover:text-[#1a4a2e]" onClick={e => e.stopPropagation()}>{p.telefono}</a>
        : null },
    { key: 'localidad', header: 'Localidad',
      render: (p: Proveedor) => <span className="text-gray-600">{p.localidad}</span> },
    { key: 'estado', header: 'Estado',
      render: (p: Proveedor) => <Badge variant={p.estado === 'activo' ? 'green' : 'gray'}>{p.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge> },
    { key: 'acciones', header: '',
      render: (p: Proveedor) => (
        <div className="flex gap-1 justify-end">
          {p.email && (
            <a href={`mailto:${p.email}`} onClick={e => e.stopPropagation()}
              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title={p.email}>
              <Mail size={13} />
            </a>
          )}
          {p.telefono && (
            <a href={`tel:${p.telefono}`} onClick={e => e.stopPropagation()}
              className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50" title={p.telefono}>
              <Phone size={13} />
            </a>
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
          <h2 className="text-xl font-bold text-gray-900">Proveedores</h2>
          <p className="text-sm text-gray-500">{proveedores.length} proveedores · {proveedores.filter(p => p.estado === 'activo').length} activos</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo proveedor</Button>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar proveedores..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table columns={columns} data={filtered} keyExtractor={p => p.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay proveedores registrados'} loading={loading}
        onRowClick={setDetail} />

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
              <div><p className="text-xs text-gray-500">Categoría</p>{detail.categoria ? <Badge variant="blue">{detail.categoria}</Badge> : <p>—</p>}</div>
              <div><p className="text-xs text-gray-500">Estado</p><Badge variant={detail.estado === 'activo' ? 'green' : 'gray'}>{detail.estado === 'activo' ? 'Activo' : 'Inactivo'}</Badge></div>
              <div><p className="text-xs text-gray-500">Contacto</p><p className="font-medium">{detail.contacto || '—'}</p></div>
            </div>
            {detail.email && <div className="flex items-center gap-2 text-sm text-gray-700"><Mail size={14} className="text-gray-400" /><a href={`mailto:${detail.email}`} className="hover:text-[#1a4a2e]">{detail.email}</a></div>}
            {detail.telefono && <div className="flex items-center gap-2 text-sm text-gray-700"><Phone size={14} className="text-gray-400" /><a href={`tel:${detail.telefono}`} className="hover:text-[#1a4a2e]">{detail.telefono}</a></div>}
            {detail.localidad && <div className="flex items-center gap-2 text-sm text-gray-700"><Building2 size={14} className="text-gray-400" />{detail.localidad}</div>}
            {detail.notas && <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600"><p className="text-xs text-gray-400 mb-1">Productos / Servicios</p>{detail.notas}</div>}
          </div>
        )}
      </Modal>

      <ProveedorForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar proveedor"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
