import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useCrud } from '../../hooks/useCrud'

export interface ProyectoData {
  id?: string
  codigo: string
  nombre: string
  cliente_id: string
  responsable_id: string
  localidad: string
  descripcion: string
  estado: string
  progreso: number
  presupuesto: number | ''
  fecha_inicio: string
  fecha_fin: string
}

const empty: ProyectoData = {
  codigo: '', nombre: '', cliente_id: '', responsable_id: '', localidad: '',
  descripcion: '', estado: 'planificacion', progreso: 0, presupuesto: '',
  fecha_inicio: '', fecha_fin: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<ProyectoData, 'id'>) => Promise<void>
  initial?: ProyectoData | null
}

export function ProyectoForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<ProyectoData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { usuarios } = useUsuarios()
  const { data: clientes } = useCrud<{ id: string; nombre: string }>('akiter_clientes', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre' })

  const set = (field: keyof ProyectoData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const val = ['progreso', 'presupuesto'].includes(field) ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
    setForm(prev => ({ ...prev, [field]: val }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.codigo.trim() || !form.nombre.trim()) { setError('Código y nombre son obligatorios'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave({
        ...data,
        cliente_id: data.cliente_id || null as unknown as string,
        responsable_id: data.responsable_id || null as unknown as string,
        presupuesto: data.presupuesto === '' ? null as unknown as number : Number(data.presupuesto),
        fecha_inicio: data.fecha_inicio || null as unknown as string,
        fecha_fin: data.fecha_fin || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar proyecto' : 'Nuevo proyecto'} size="xl"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="proyecto-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="proyecto-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Código *" value={form.codigo} onChange={set('codigo')} placeholder="PRY-2024-001" />
          <div className="col-span-2 sm:col-span-1">
            <Input label="Nombre del proyecto *" value={form.nombre} onChange={set('nombre')} placeholder="Instalación Solar Málaga" />
          </div>
          <Select label="Cliente" value={form.cliente_id} onChange={set('cliente_id')} placeholder="Sin cliente"
            options={clientes.map(c => ({ value: c.id, label: c.nombre }))} />
          <Select label="Responsable" value={form.responsable_id} onChange={set('responsable_id')} placeholder="Sin asignar"
            options={usuarios.map(u => ({ value: u.id, label: `${u.nombre ?? ''} ${u.apellidos ?? ''}`.trim() || u.email }))} />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'planificacion', label: 'Planificación' },
            { value: 'en_curso', label: 'En curso' },
            { value: 'pausado', label: 'Pausado' },
            { value: 'finalizado', label: 'Finalizado' },
            { value: 'cancelado', label: 'Cancelado' },
          ]} />
          <Input label="Localidad" value={form.localidad} onChange={set('localidad')} placeholder="Málaga" />
          <Input label="Presupuesto (€)" type="number" min="0" value={form.presupuesto} onChange={set('presupuesto')} placeholder="0" />
          <Input label="Progreso (%)" type="number" min="0" max="100" value={form.progreso} onChange={set('progreso')} />
          <Input label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
          <Input label="Fecha fin prevista" type="date" value={form.fecha_fin} onChange={set('fecha_fin')} />
          <div className="col-span-2">
            <Textarea label="Descripción" value={form.descripcion} onChange={set('descripcion')} placeholder="Descripción del proyecto..." />
          </div>
        </div>
      </form>
    </Modal>
  )
}
