import { useState } from 'react'
import { Plus, Search, Package, AlertTriangle, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Table } from '../../components/ui/Table'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { InventarioForm, type InventarioData } from '../../components/forms/InventarioForm'
import { useCrud } from '../../hooks/useCrud'
import { useAuthStore } from '../../store/authStore'

interface Item extends InventarioData { id: string; updated_at: string }

function stockStatus(item: Item) {
  if ((item.stock as number) === 0) return { label: 'Sin stock', color: 'red' as const }
  if ((item.stock as number) <= (item.stock_minimo as number)) return { label: 'Stock bajo', color: 'orange' as const }
  return { label: 'Disponible', color: 'green' as const }
}

interface MovimientoForm { tipo: string; cantidad: number; motivo: string }

export function Inventario() {
  const { user } = useAuthStore()
  const readOnly = user?.rol === 'tecnico'

  const { data: items, loading, create, update, remove } = useCrud<Item>('akiter_inventario', {
    orderBy: 'nombre', orderAsc: true,
  })

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [movTarget, setMovTarget] = useState<Item | null>(null)
  const [mov, setMov] = useState<MovimientoForm>({ tipo: 'entrada', cantidad: 1, motivo: '' })
  const [movLoading, setMovLoading] = useState(false)

  const filtered = items.filter(i =>
    i.nombre.toLowerCase().includes(search.toLowerCase()) ||
    i.referencia.toLowerCase().includes(search.toLowerCase()) ||
    i.categoria?.toLowerCase().includes(search.toLowerCase())
  )

  const bajoStock = items.filter(i => (i.stock as number) <= (i.stock_minimo as number)).length

  const handleSave = async (data: Omit<InventarioData, 'id'>) => {
    if (editing) await update(editing.id, data)
    else await create(data as Omit<Item, 'id' | 'created_at' | 'updated_at'>)
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const handleMovimiento = async () => {
    if (!movTarget || mov.cantidad <= 0) return
    setMovLoading(true)
    const currentStock = movTarget.stock as number
    const delta = mov.tipo === 'salida' ? -mov.cantidad : mov.cantidad
    const newStock = Math.max(0, currentStock + delta)
    await update(movTarget.id, { stock: newStock })
    setMovLoading(false)
    setMovTarget(null)
    setMov({ tipo: 'entrada', cantidad: 1, motivo: '' })
  }

  const columns = [
    {
      key: 'referencia', header: 'Referencia',
      render: (i: Item) => <span className="font-mono text-xs text-gray-600">{i.referencia}</span>,
    },
    {
      key: 'nombre', header: 'Artículo',
      render: (i: Item) => (
        <div className="flex items-center gap-2">
          {(i.stock as number) <= (i.stock_minimo as number) && <AlertTriangle size={13} className="text-orange-400 flex-shrink-0" />}
          <span className="font-medium text-gray-900">{i.nombre}</span>
        </div>
      ),
    },
    { key: 'categoria', header: 'Categoría', render: (i: Item) => i.categoria ? <Badge variant="blue">{i.categoria}</Badge> : null },
    {
      key: 'stock', header: 'Stock',
      render: (i: Item) => (
        <div>
          <span className="font-semibold text-gray-900">{i.stock}</span>
          <span className="text-gray-400 text-xs"> / {i.stock_minimo} mín · {i.unidad}</span>
        </div>
      ),
    },
    { key: 'ubicacion', header: 'Ubicación', render: (i: Item) => <span className="text-gray-500 text-sm">{i.ubicacion}</span> },
    { key: 'precio_unitario', header: 'P. Unit.', render: (i: Item) => i.precio_unitario ? <span className="text-gray-700">{Number(i.precio_unitario).toFixed(2)} €/{i.unidad}</span> : null },
    { key: 'estado', header: 'Estado', render: (i: Item) => { const s = stockStatus(i); return <Badge variant={s.color}>{s.label}</Badge> } },
    {
      key: 'acciones', header: '',
      render: (i: Item) => (
        <div className="flex gap-1 justify-end">
          <button onClick={e => { e.stopPropagation(); setMovTarget(i); setMov({ tipo: 'entrada', cantidad: 1, motivo: '' }) }} className="p-1.5 rounded text-gray-400 hover:text-[#1a4a2e] hover:bg-[#f0f7f3] cursor-pointer" title="Movimiento de stock"><ArrowUpCircle size={14} /></button>
          {!readOnly && <>
            <button onClick={e => { e.stopPropagation(); setEditing(i); setFormOpen(true) }} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"><Pencil size={14} /></button>
            <button onClick={e => { e.stopPropagation(); setDeleteTarget(i) }} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 size={14} /></button>
          </>}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inventario</h2>
          <p className="text-sm text-gray-500">{items.length} referencias{readOnly ? ' · Solo lectura' : ''}</p>
        </div>
        {!readOnly && <Button onClick={() => { setEditing(null); setFormOpen(true) }}><Plus size={16} /> Nuevo artículo</Button>}
      </div>

      {bajoStock > 0 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-800">
          <AlertTriangle size={18} />
          <p className="text-sm font-medium">{bajoStock} artículo(s) con stock bajo o sin stock.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-[#f0f7f3] rounded-lg"><Package size={18} className="text-[#1a4a2e]" /></div>
          <div><p className="text-xs text-gray-500">Referencias</p><p className="text-2xl font-bold text-gray-900">{items.length}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg"><AlertTriangle size={18} className="text-orange-600" /></div>
          <div><p className="text-xs text-gray-500">Stock bajo</p><p className="text-2xl font-bold text-orange-600">{bajoStock}</p></div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
          <div className="p-2 bg-green-50 rounded-lg"><Package size={18} className="text-green-700" /></div>
          <div><p className="text-xs text-gray-500">Disponibles</p><p className="text-2xl font-bold text-green-700">{items.length - bajoStock}</p></div>
        </div>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar materiales..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      <Table columns={columns} data={filtered} keyExtractor={i => i.id}
        emptyMessage={loading ? 'Cargando...' : 'No se encontraron artículos'} loading={loading} />

      {/* Stock movement modal */}
      <Modal open={!!movTarget} onClose={() => setMovTarget(null)} title={`Movimiento — ${movTarget?.nombre}`} size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setMovTarget(null)}>Cancelar</Button>
          <Button onClick={handleMovimiento} loading={movLoading}>Aplicar</Button>
        </>}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Stock actual: <strong>{movTarget?.stock} {movTarget?.unidad}</strong></p>
          <div className="flex gap-2">
            {(['entrada', 'salida', 'ajuste'] as const).map(t => (
              <button key={t} onClick={() => setMov(m => ({ ...m, tipo: t }))}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium cursor-pointer transition-colors ${mov.tipo === t ? 'bg-[#1a4a2e] text-white border-[#1a4a2e]' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                {t === 'entrada' ? <ArrowUpCircle size={14} /> : t === 'salida' ? <ArrowDownCircle size={14} /> : <Package size={14} />}
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <Input label="Cantidad" type="number" min="0" step="0.01" value={mov.cantidad}
            onChange={e => setMov(m => ({ ...m, cantidad: Number(e.target.value) }))} />
          <Input label="Motivo (opcional)" value={mov.motivo}
            onChange={e => setMov(m => ({ ...m, motivo: e.target.value }))} placeholder="Ej: Entrada albarán 2024-123" />
          <p className="text-sm text-gray-500">
            Stock resultante: <strong className="text-gray-900">
              {mov.tipo === 'salida'
                ? Math.max(0, (movTarget?.stock as number ?? 0) - mov.cantidad)
                : (movTarget?.stock as number ?? 0) + mov.cantidad
              } {movTarget?.unidad}
            </strong>
          </p>
        </div>
      </Modal>

      <InventarioForm open={formOpen} onClose={() => setFormOpen(false)} onSave={handleSave} initial={editing} />

      <ConfirmDialog open={!!deleteTarget} title="Eliminar artículo"
        message={`¿Eliminar "${deleteTarget?.nombre}"?`}
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} loading={deleting} />
    </div>
  )
}
