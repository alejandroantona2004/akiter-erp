import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useCrud } from '../../hooks/useCrud'

export interface ParteTrabajoData {
  id?: string
  numero: string
  proyecto_id: string
  tecnico_id: string
  fecha: string
  horas: number | ''
  descripcion: string
  estado: string
  notas: string
}

const empty: ParteTrabajoData = {
  numero: '', proyecto_id: '', tecnico_id: '',
  fecha: new Date().toISOString().slice(0, 10),
  horas: 8, descripcion: '', estado: 'borrador', notas: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<ParteTrabajoData, 'id'>) => Promise<void>
  initial?: ParteTrabajoData | null
}

export function ParteTrabajoForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<ParteTrabajoData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { usuarios } = useUsuarios()
  const { data: proyectos } = useCrud<{ id: string; nombre: string; codigo: string }>(
    'akiter_proyectos', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre,codigo' }
  )

  const tecnicos = usuarios.filter(u => ['tecnico', 'direccion', 'subcontratista'].includes(u.rol))

  const set = (field: keyof ParteTrabajoData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: field === 'horas' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.numero.trim()) { setError('El número es obligatorio'); return }
    if (!form.fecha) { setError('La fecha es obligatoria'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave({
        ...data,
        horas: data.horas === '' ? 0 : Number(data.horas),
        proyecto_id: data.proyecto_id || null as unknown as string,
        tecnico_id: data.tecnico_id || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar parte de trabajo' : 'Nuevo parte de trabajo'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="parte-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="parte-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Número *" value={form.numero} onChange={set('numero')} placeholder="PT-2024-0001" />
          <Input label="Fecha *" type="date" value={form.fecha} onChange={set('fecha')} />
          <Select label="Proyecto" value={form.proyecto_id} onChange={set('proyecto_id')} placeholder="Sin proyecto"
            options={proyectos.map(p => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` }))} />
          <Select label="Técnico" value={form.tecnico_id} onChange={set('tecnico_id')} placeholder="Sin asignar"
            options={tecnicos.map(u => ({ value: u.id, label: `${u.nombre ?? ''} ${u.apellidos ?? ''}`.trim() || u.email }))} />
          <Input label="Horas" type="number" min="0" step="0.5" value={form.horas} onChange={set('horas')} />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'borrador',        label: 'Borrador' },
            { value: 'pendiente_firma', label: 'Pendiente de firma' },
            { value: 'firmado',         label: 'Firmado' },
            { value: 'facturado',       label: 'Facturado' },
          ]} />
          <div className="col-span-2">
            <Textarea label="Descripción de trabajos realizados" value={form.descripcion} onChange={set('descripcion')}
              placeholder="Descripción detallada de los trabajos realizados..." rows={3} />
          </div>
          <div className="col-span-2">
            <Textarea label="Notas internas" value={form.notas} onChange={set('notas')} placeholder="Notas adicionales..." rows={2} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
