import { useState } from 'react'
import { Plus, Search, Download, Pencil, Trash2, Send, CheckCircle, XCircle } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { PresupuestoForm, type PresupuestoData } from '../../components/forms/PresupuestoForm'
import { useCrud } from '../../hooks/useCrud'
import { generarPDFPresupuesto } from '../../lib/pdf'

interface Presupuesto extends PresupuestoData {
  id: string
  created_at: string
  base_imponible: number
  total: number
  akiter_clientes?: { nombre: string; cif?: string; localidad?: string; email?: string }
}

const estadoConfig = {
  borrador:  { label: 'Borrador',  color: 'gray' as const },
  enviado:   { label: 'Enviado',   color: 'blue' as const },
  aceptado:  { label: 'Aceptado',  color: 'green' as const },
  rechazado: { label: 'Rechazado', color: 'red' as const },
  expirado:  { label: 'Expirado',  color: 'orange' as const },
}

export function Presupuestos() {
  const { data, loading, create, update, remove } = useCrud<Presupuesto>('akiter_presupuestos', {
    orderBy: 'created_at', orderAsc: false,
    select: '*, akiter_clientes(nombre,cif,localidad,email)',
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Presupuesto | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Presupuesto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = data.filter(p =>
    p.numero.toLowerCase().includes(search.toLowerCase()) ||
    p.akiter_clientes?.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (p: Presupuesto) => { setEditing(p); setFormOpen(true) }

  const handleSave = async (formData: Omit<PresupuestoData, 'id'>) => {
    const { lineas, ...rest } = formData
    const base_imponible = lineas.reduce((s, l) => s + l.total, 0)
    const payload = { ...rest, lineas: lineas as unknown as PresupuestoData['lineas'], base_imponible }
    if (editing) await update(editing.id, payload)
    else await create(payload as Omit<Presupuesto, 'id' | 'created_at' | 'updated_at'>)
  }

  const changeEstado = (p: Presupuesto, estado: string) => update(p.id, { estado })

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const downloadPDF = async (p: Presupuesto) => {
    await generarPDFPresupuesto(p, p.akiter_clientes)
  }

  const totalEnviado = filtered.filter(p => p.estado === 'enviado').reduce((s, p) => s + (p.total ?? 0), 0)
  const totalAceptado = filtered.filter(p => p.estado === 'aceptado').reduce((s, p) => s + (p.total ?? 0), 0)

  const columns = [
    { key: 'numero', header: 'Número', render: (p: Presupuesto) => <span className="font-mono text-sm font-medium text-gray-900">{p.numero}</span> },
    { key: 'cliente', header: 'Cliente', render: (p: Presupuesto) => <span className="text-gray-700">{p.akiter_clientes?.nombre ?? '—'}</span> },
    { key: 'descripcion', header: 'Descripción', render: (p: Presupuesto) => <span className="text-gray-500 text-sm">{p.descripcion}</span> },
    { key: 'total', header: 'Total', render: (p: Presupuesto) => <span className="font-bold text-gray-900">{(p.total ?? 0).toLocaleString('es-ES')} €</span> },
    { key: 'fecha_emision', header: 'Fecha', render: (p: Presupuesto) => <span className="text-gray-400 text-sm">{p.fecha_emision}</span> },
    { key: 'estado', header: 'Estado', render: (p: Presupuesto) => <Badge variant={estadoConfig[p.estado as keyof typeof estadoConfig]?.color ?? 'gray'}>{estadoConfig[p.estado as keyof typeof estadoConfig]?.label ?? p.estado}</Badge> },
    {
      key: 'acciones', header: '',
      render: (p: Presupuesto) => (
        <div className="flex gap-1 justify-end">
          <button onClick={e => { e.stopPropagation(); openEdit(p) }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer" title="Editar"><Pencil size={13} /></button>
          <button onClick={e => { e.stopPropagation(); downloadPDF(p) }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer" title="Descargar PDF"><Download size={13} /></button>
          {p.estado === 'borrador' && (
            <button onClick={e => { e.stopPropagation(); changeEstado(p, 'enviado') }} className="p-1.5 rounded text-blue-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer" title="Marcar enviado"><Send size={13} /></button>
          )}
          {p.estado === 'enviado' && (<>
            <button onClick={e => { e.stopPropagation(); changeEstado(p, 'aceptado') }} className="p-1.5 rounded text-green-400 hover:text-green-700 hover:bg-green-50 cursor-pointer" title="Aceptar"><CheckCircle size={13} /></button>
            <button onClick={e => { e.stopPropagation(); changeEstado(p, 'rechazado') }} className="p-1.5 rounded text-red-400 hover:text-red-700 hover:bg-red-50 cursor-pointer" title="Rechazar"><XCircle size={13} /></button>
          </>)}
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(p) }} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer" title="Eliminar"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Presupuestos</h2>
          <p className="text-sm text-gray-500">{data.length} presupuestos</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nuevo presupuesto</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Object.entries(estadoConfig).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <Badge variant={cfg.color}>{cfg.label}</Badge>
            <p className="text-2xl font-bold text-gray-900 mt-2">{data.filter(p => p.estado === key).length}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 flex-wrap items-center">
        <div className="max-w-xs flex-1">
          <Input placeholder="Buscar presupuestos..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
        </div>
        <div className="flex gap-4 text-sm text-gray-500">
          <span>Enviado: <strong className="text-gray-900">{totalEnviado.toLocaleString('es-ES')} €</strong></span>
          <span>Aceptado: <strong className="text-green-700">{totalAceptado.toLocaleString('es-ES')} €</strong></span>
        </div>
      </div>

      <Table
        columns={columns}
        data={filtered}
        keyExtractor={p => p.id}
        emptyMessage={loading ? 'Cargando...' : 'No se encontraron presupuestos'}
        loading={loading}
      />

      <PresupuestoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar presupuesto"
        message={`¿Eliminar "${deleteTarget?.numero}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
