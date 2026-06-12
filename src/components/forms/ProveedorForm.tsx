import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'

export interface ProveedorData {
  id?: string
  nombre: string
  cif: string
  categoria: string
  contacto: string
  email: string
  telefono: string
  localidad: string
  estado: string
  notas: string
}

const empty: ProveedorData = {
  nombre: '', cif: '', categoria: '', contacto: '',
  email: '', telefono: '', localidad: '', estado: 'activo', notas: '',
}

const CATEGORIAS = ['Fotovoltaico', 'Cableado', 'Estructura', 'Climatización', 'Fontanería', 'Herramientas', 'Material Eléctrico', 'Transporte', 'Servicios', 'Otro']

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<ProveedorData, 'id'>) => Promise<void>
  initial?: ProveedorData | null
}

export function ProveedorForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<ProveedorData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof ProveedorData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave(data)
      onClose()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar proveedor' : 'Nuevo proveedor'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="prov-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="prov-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Nombre / Razón social *" value={form.nombre} onChange={set('nombre')} placeholder="Proveedor S.L." />
          </div>
          <Input label="CIF / NIF" value={form.cif} onChange={set('cif')} placeholder="B12345678" />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'activo',   label: 'Activo' },
            { value: 'inactivo', label: 'Inactivo' },
          ]} />
          <Select label="Categoría" value={form.categoria} onChange={set('categoria')} placeholder="Seleccionar..."
            options={CATEGORIAS.map(c => ({ value: c, label: c }))} />
          <Input label="Persona de contacto" value={form.contacto} onChange={set('contacto')} placeholder="Nombre apellidos" />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="contacto@proveedor.com" />
          <Input label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="952 000 000" />
          <div className="col-span-2">
            <Input label="Localidad" value={form.localidad} onChange={set('localidad')} placeholder="Málaga" />
          </div>
          <div className="col-span-2">
            <Textarea label="Productos / Servicios que suministra" value={form.notas} onChange={set('notas')}
              placeholder="Paneles solares, inversores, material eléctrico..." rows={2} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
