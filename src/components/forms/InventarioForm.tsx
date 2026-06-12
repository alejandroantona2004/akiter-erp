import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Button } from '../ui/Button'
import { useCrud } from '../../hooks/useCrud'

export interface InventarioData {
  id?: string
  referencia: string
  nombre: string
  categoria: string
  stock: number | ''
  stock_minimo: number | ''
  unidad: string
  precio_unitario: number | ''
  ubicacion: string
  proveedor_id: string
}

const empty: InventarioData = {
  referencia: '', nombre: '', categoria: '', stock: 0,
  stock_minimo: 0, unidad: 'ud', precio_unitario: '', ubicacion: '', proveedor_id: '',
}

const CATEGORIAS = ['Fotovoltaico', 'Cableado', 'Estructura', 'Climatización', 'Fontanería', 'Herramientas', 'Otro']
const UNIDADES = ['ud', 'm', 'm²', 'm³', 'kg', 'l', 'caja', 'rollo', 'juego']

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<InventarioData, 'id'>) => Promise<void>
  initial?: InventarioData | null
}

export function InventarioForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<InventarioData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { data: proveedores } = useCrud<{ id: string; nombre: string }>('akiter_proveedores', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre' })

  const set = (field: keyof InventarioData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const num = ['stock', 'stock_minimo', 'precio_unitario']
    const val = num.includes(field) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
    setForm(prev => ({ ...prev, [field]: val }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.referencia.trim() || !form.nombre.trim()) { setError('Referencia y nombre son obligatorios'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave({
        ...data,
        stock: data.stock === '' ? 0 : Number(data.stock),
        stock_minimo: data.stock_minimo === '' ? 0 : Number(data.stock_minimo),
        precio_unitario: data.precio_unitario === '' ? null as unknown as number : Number(data.precio_unitario),
        proveedor_id: data.proveedor_id || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar artículo' : 'Nuevo artículo'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="inv-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="inv-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Referencia *" value={form.referencia} onChange={set('referencia')} placeholder="PNL-MONO-400W" />
          <div className="col-span-2 sm:col-span-1">
            <Input label="Nombre *" value={form.nombre} onChange={set('nombre')} placeholder="Panel Solar Monocristalino 400W" />
          </div>
          <Select label="Categoría" value={form.categoria} onChange={set('categoria')} placeholder="Seleccionar..."
            options={CATEGORIAS.map(c => ({ value: c, label: c }))} />
          <Select label="Unidad" value={form.unidad} onChange={set('unidad')}
            options={UNIDADES.map(u => ({ value: u, label: u }))} />
          <Input label="Stock actual" type="number" min="0" step="0.01" value={form.stock} onChange={set('stock')} />
          <Input label="Stock mínimo" type="number" min="0" step="0.01" value={form.stock_minimo} onChange={set('stock_minimo')} />
          <Input label="Precio unitario (€)" type="number" min="0" step="0.01" value={form.precio_unitario} onChange={set('precio_unitario')} placeholder="0.00" />
          <Input label="Ubicación" value={form.ubicacion} onChange={set('ubicacion')} placeholder="Almacén A-1" />
          <div className="col-span-2">
            <Select label="Proveedor" value={form.proveedor_id} onChange={set('proveedor_id')} placeholder="Sin proveedor"
              options={proveedores.map(p => ({ value: p.id, label: p.nombre }))} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
