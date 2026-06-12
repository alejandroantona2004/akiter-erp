import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useUsuarios } from '../../hooks/useUsuarios'
import type { User } from '../../types'

export interface LeadData {
  id?: string
  nombre: string
  empresa: string
  email: string
  telefono: string
  etapa: string
  valor: number
  asignado_id: string
  notas: string
}

const empty: LeadData = {
  nombre: '', empresa: '', email: '', telefono: '',
  etapa: 'nuevo', valor: 0, asignado_id: '', notas: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<LeadData, 'id'>) => Promise<void>
  initial?: LeadData | null
}

export function LeadForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<LeadData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { usuarios } = useUsuarios()

  const set = (field: keyof LeadData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: field === 'valor' ? Number(e.target.value) : e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true)
    setError('')
    try {
      const { id: _, ...data } = form
      await onSave({ ...data, asignado_id: data.asignado_id || null as unknown as string })
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
      title={initial?.id ? 'Editar lead' : 'Nuevo lead'}
      size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="lead-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nombre *" value={form.nombre} onChange={set('nombre')} placeholder="Juan García" />
          <Input label="Empresa" value={form.empresa} onChange={set('empresa')} placeholder="Empresa S.L." />
          <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="juan@empresa.com" />
          <Input label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="666 000 000" />
          <Select label="Etapa" value={form.etapa} onChange={set('etapa')} options={[
            { value: 'nuevo', label: 'Nuevo' },
            { value: 'contactado', label: 'Contactado' },
            { value: 'propuesta', label: 'Propuesta enviada' },
            { value: 'negociacion', label: 'En negociación' },
            { value: 'ganado', label: 'Ganado' },
            { value: 'perdido', label: 'Perdido' },
          ]} />
          <Input label="Valor estimado (€)" type="number" min="0" value={form.valor} onChange={set('valor')} />
          <div className="col-span-2">
            <Select
              label="Asignado a"
              value={form.asignado_id}
              onChange={set('asignado_id')}
              placeholder="Sin asignar"
              options={usuarios.map((u: User) => ({ value: u.id, label: `${u.nombre ?? ''} ${u.apellidos ?? ''}`.trim() || u.email }))}
            />
          </div>
          <div className="col-span-2">
            <Textarea label="Notas" value={form.notas} onChange={set('notas')} placeholder="Observaciones..." />
          </div>
        </div>
      </form>
    </Modal>
  )
}
