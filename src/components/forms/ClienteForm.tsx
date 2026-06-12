import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'

export interface ClienteData {
  id?: string
  nombre: string
  cif: string
  email: string
  telefono: string
  localidad: string
  provincia: string
  direccion: string
  estado: string
  notas: string
}

const empty: ClienteData = {
  nombre: '', cif: '', email: '', telefono: '',
  localidad: '', provincia: '', direccion: '', estado: 'activo', notas: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<ClienteData, 'id'>) => Promise<void>
  initial?: ClienteData | null
}

export function ClienteForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<ClienteData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (field: keyof ClienteData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const handleOpen = () => { setForm(initial ?? empty); setError('') }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    setError('')
    try {
      const { id: _, ...data } = form
      await onSave(data)
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial?.id ? 'Editar cliente' : 'Nuevo cliente'}
      size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="cliente-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="cliente-form" onSubmit={handleSubmit} className="space-y-4" onFocus={handleOpen}>
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Nombre / Razón social *" value={form.nombre} onChange={set('nombre')} placeholder="Empresa S.L." />
          </div>
          <Input label="CIF / NIF" value={form.cif} onChange={set('cif')} placeholder="B12345678" />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'activo', label: 'Activo' },
            { value: 'potencial', label: 'Potencial' },
            { value: 'inactivo', label: 'Inactivo' },
          ]} />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="info@empresa.com" />
          <Input label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="952 000 000" />
          <Input label="Localidad" value={form.localidad} onChange={set('localidad')} placeholder="Málaga" />
          <Input label="Provincia" value={form.provincia} onChange={set('provincia')} placeholder="Málaga" />
          <div className="col-span-2">
            <Input label="Dirección" value={form.direccion} onChange={set('direccion')} placeholder="Calle Mayor 1, 1º" />
          </div>
          <div className="col-span-2">
            <Textarea label="Notas" value={form.notas} onChange={set('notas')} placeholder="Observaciones..." />
          </div>
        </div>
      </form>
    </Modal>
  )
}
