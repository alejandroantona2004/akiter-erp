import { useState } from 'react'
import { Plus, Search, Pencil, Trash2, Mail, Phone, CheckCircle } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { CobroForm, type CobroData } from '../../components/forms/CobroForm'
import { useCrud } from '../../hooks/useCrud'

interface Cobro extends CobroData {
  id: string
  created_at: string
  akiter_facturas?: { numero: string }
  akiter_clientes?: { nombre: string; email?: string; telefono?: string }
}

const formaPagoConfig: Record<string, { label: string; color: 'green' | 'blue' | 'gold' | 'gray' | 'purple' }> = {
  transferencia: { label: 'Transferencia', color: 'blue' },
  efectivo:      { label: 'Efectivo',      color: 'green' },
  cheque:        { label: 'Cheque',        color: 'gold' },
  tarjeta:       { label: 'Tarjeta',       color: 'purple' },
  otro:          { label: 'Otro',          color: 'gray' },
}

export function Cobros() {
  const { data: cobros, loading, create, update, remove } = useCrud<Cobro>('akiter_cobros', {
    orderBy: 'fecha_cobro', orderAsc: false,
    select: '*, akiter_facturas(numero), akiter_clientes(nombre,email,telefono)',
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Cobro | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Cobro | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = cobros.filter(c =>
    c.akiter_clientes?.nombre.toLowerCase().includes(search.toLowerCase()) ||
    c.akiter_facturas?.numero.toLowerCase().includes(search.toLowerCase()) ||
    c.referencia?.toLowerCase().includes(search.toLowerCase()) ||
    c.numero?.toLowerCase().includes(search.toLowerCase())
  )

  const totalCobrado = cobros.reduce((s, c) => s + Number(c.importe ?? 0), 0)

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (c: Cobro) => { setEditing(c); setFormOpen(true) }

  const handleSave = async (data: Omit<CobroData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Cobro, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const columns = [
    { key: 'numero', header: 'Referencia',
      render: (c: Cobro) => <span className="font-mono text-sm text-gray-700">{c.numero ?? '—'}</span> },
    { key: 'cliente', header: 'Cliente',
      render: (c: Cobro) => <span className="font-medium text-gray-900">{c.akiter_clientes?.nombre ?? '—'}</span> },
    { key: 'factura', header: 'Factura',
      render: (c: Cobro) => c.akiter_facturas
        ? <span className="font-mono text-sm text-gray-600">{c.akiter_facturas.numero}</span>
        : <span className="text-gray-400">Sin factura</span> },
    { key: 'importe', header: 'Importe',
      render: (c: Cobro) => <span className="font-bold text-[#1a4a2e]">{Number(c.importe).toLocaleString('es-ES')} €</span> },
    { key: 'fecha_cobro', header: 'Fecha cobro',
      render: (c: Cobro) => <span className="text-gray-500 text-sm">{c.fecha_cobro}</span> },
    { key: 'forma_pago', header: 'Forma de pago',
      render: (c: Cobro) => {
        const cfg = formaPagoConfig[c.forma_pago] ?? { label: c.forma_pago, color: 'gray' as const }
        return <Badge variant={cfg.color}>{cfg.label}</Badge>
      } },
    { key: 'referencia', header: 'Ref. bancaria',
      render: (c: Cobro) => <span className="text-gray-400 text-xs font-mono">{c.referencia || '—'}</span> },
    { key: 'acciones', header: '',
      render: (c: Cobro) => (
        <div className="flex gap-1 justify-end">
          {c.akiter_clientes?.email && (
            <a href={`mailto:${c.akiter_clientes.email}`}
              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="Email cliente">
              <Mail size={13} />
            </a>
          )}
          <button onClick={e => { e.stopPropagation(); openEdit(c) }}
            className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"><Pencil size={13} /></button>
          <button onClick={e => { e.stopPropagation(); setDeleteTarget(c) }}
            className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 size={13} /></button>
        </div>
      ) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Cobros</h2>
          <p className="text-sm text-gray-500">{cobros.length} cobros registrados</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Registrar cobro</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:col-span-2">
          <p className="text-xs text-gray-500">Total cobrado (período)</p>
          <p className="text-3xl font-bold text-green-700 mt-1">{totalCobrado.toLocaleString('es-ES')} €</p>
        </div>
        {Object.entries(formaPagoConfig).slice(0, 2).map(([key, cfg]) => (
          <div key={key} className="bg-white rounded-xl border border-gray-200 p-4">
            <Badge variant={cfg.color}>{cfg.label}</Badge>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {cobros.filter(c => c.forma_pago === key).length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {cobros.filter(c => c.forma_pago === key).reduce((s, c) => s + Number(c.importe ?? 0), 0).toLocaleString('es-ES')} €
            </p>
          </div>
        ))}
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar cobros..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table columns={columns} data={filtered} keyExtractor={c => c.id}
        emptyMessage={loading ? 'Cargando...' : 'No hay cobros registrados'} loading={loading} />

      <CobroForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar cobro"
        message={`¿Eliminar el cobro de ${Number(deleteTarget?.importe ?? 0).toLocaleString('es-ES')} €? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
