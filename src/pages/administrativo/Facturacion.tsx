import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, CheckCircle, Clock, Download } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { FacturaForm, type FacturaData } from '../../components/forms/FacturaForm'
import { useCrud } from '../../hooks/useCrud'
import { generarPDFFactura } from '../../lib/pdf'

interface Factura extends FacturaData {
  id: string
  created_at: string
  base_imponible: number
  total: number
  akiter_clientes?: { nombre: string; cif?: string; localidad?: string; email?: string }
}

const estadoConfig = {
  borrador: { label: 'Borrador', color: 'gray' as const },
  emitida:  { label: 'Emitida',  color: 'blue' as const },
  cobrada:  { label: 'Cobrada',  color: 'green' as const },
  vencida:  { label: 'Vencida',  color: 'red' as const },
}

export function Facturacion() {
  const { data, loading, create, update, remove } = useCrud<Factura>('akiter_facturas', {
    orderBy: 'created_at', orderAsc: false,
    select: '*, akiter_clientes(nombre,cif,localidad,email)',
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Factura | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Factura | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = data.filter(f =>
    f.numero.toLowerCase().includes(search.toLowerCase()) ||
    f.akiter_clientes?.nombre.toLowerCase().includes(search.toLowerCase()) ||
    f.concepto?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (f: Factura) => { setEditing(f); setFormOpen(true) }

  const handleSave = async (formData: Omit<FacturaData, 'id'>) => {
    const { lineas, ...rest } = formData
    const base_imponible = lineas.reduce((s, l) => s + l.total, 0)
    const total = base_imponible * (1 + rest.iva_porcentaje / 100)
    const payload = { ...rest, lineas, base_imponible, total }
    if (editing) await update(editing.id, payload)
    else await create(payload as Omit<Factura, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const totalEmitido   = data.filter(f => f.estado !== 'borrador').reduce((s, f) => s + Number(f.total ?? 0), 0)
  const totalCobrado   = data.filter(f => f.estado === 'cobrada').reduce((s, f) => s + Number(f.total ?? 0), 0)
  const totalPendiente = data.filter(f => f.estado === 'emitida').reduce((s, f) => s + Number(f.total ?? 0), 0)

  const columns = [
    { key: 'numero', header: 'Nº Factura',
      render: (f: Factura) => <span className="font-mono text-sm font-medium text-gray-900">{f.numero}</span> },
    { key: 'cliente', header: 'Cliente',
      render: (f: Factura) => <span className="text-gray-700">{f.akiter_clientes?.nombre ?? '—'}</span> },
    { key: 'concepto', header: 'Concepto',
      render: (f: Factura) => <span className="text-gray-500 text-sm truncate max-w-xs block">{f.concepto}</span> },
    { key: 'base_imponible', header: 'Base',
      render: (f: Factura) => <span className="text-gray-600">{Number(f.base_imponible ?? 0).toLocaleString('es-ES')} €</span> },
    { key: 'total', header: 'Total',
      render: (f: Factura) => <span className="font-bold text-gray-900">{Number(f.total ?? 0).toLocaleString('es-ES')} €</span> },
    { key: 'fecha_emision', header: 'Emisión',
      render: (f: Factura) => <span className="text-gray-400 text-sm">{f.fecha_emision}</span> },
    { key: 'fecha_vencimiento', header: 'Vencimiento',
      render: (f: Factura) => <span className="text-gray-400 text-sm">{f.fecha_vencimiento ?? '—'}</span> },
    { key: 'estado', header: 'Estado',
      render: (f: Factura) => {
        const cfg = estadoConfig[f.estado as keyof typeof estadoConfig]
        return <Badge variant={cfg?.color ?? 'gray'}>{cfg?.label ?? f.estado}</Badge>
      } },
    { key: 'acciones', header: '',
      render: (f: Factura) => (
        <div className="flex gap-1 justify-end">
          <button onClick={e => { e.stopPropagation(); generarPDFFactura(f, f.akiter_clientes) }}
            className="p-1.5 rounded text-gray-400 hover:text-[#1a4a2e] hover:bg-green-50 cursor-pointer" title="Descargar PDF">
            <Download size={13} />
          </button>
          <button onClick={e => { e.stopPropagation(); openEdit(f) }}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer" title="Editar">
            <Pencil size={13} />
          </button>
          {f.estado === 'borrador' && (
            <button onClick={e => { e.stopPropagation(); update(f.id, { estado: 'emitida' }) }}
              className="p-1.5 rounded text-blue-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer" title="Emitir">
              <Clock size={13} />
            </button>
          )}
          {f.estado === 'emitida' && (
            <button onClick={e => { e.stopPropagation(); update(f.id, { estado: 'cobrada' }) }}
              className="p-1.5 rounded text-green-400 hover:text-green-700 hover:bg-green-50 cursor-pointer" title="Marcar cobrada">
              <CheckCircle size={13} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(f) }}
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer" title="Eliminar">
            <Trash2 size={13} />
          </button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Facturación</h2>
          <p className="text-sm text-gray-500">{data.length} facturas</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Nueva factura</Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total emitido</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalEmitido.toLocaleString('es-ES')} €</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Cobrado</p>
          <p className="text-2xl font-bold text-green-700 mt-1">{totalCobrado.toLocaleString('es-ES')} €</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Pendiente cobro</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{totalPendiente.toLocaleString('es-ES')} €</p>
        </div>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar facturas..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table columns={columns} data={filtered} keyExtractor={f => f.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay facturas'} loading={loading} />

      <FacturaForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar factura"
        message={`¿Eliminar la factura "${deleteTarget?.numero}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
