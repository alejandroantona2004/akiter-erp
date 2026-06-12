import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useUsuarios } from '../../hooks/useUsuarios'
import { useCrud } from '../../hooks/useCrud'

export interface OrdenTrabajoData {
  id?: string
  numero: string
  proyecto_id: string
  subcontratista_id: string
  descripcion: string
  localidad: string
  fecha_inicio: string
  fecha_fin: string
  horas_estimadas: number | ''
  estado: string
  notas: string
}

const empty: OrdenTrabajoData = {
  numero: '', proyecto_id: '', subcontratista_id: '', descripcion: '',
  localidad: '', fecha_inicio: '', fecha_fin: '', horas_estimadas: '',
  estado: 'asignada', notas: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<OrdenTrabajoData, 'id'>) => Promise<void>
  initial?: OrdenTrabajoData | null
}

export function OrdenTrabajoForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<OrdenTrabajoData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { usuarios } = useUsuarios()
  const { data: proyectos } = useCrud<{ id: string; nombre: string; codigo: string }>(
    'akiter_proyectos', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre,codigo' }
  )

  const subcontratistas = usuarios.filter(u => u.rol === 'subcontratista')

  const set = (field: keyof OrdenTrabajoData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: field === 'horas_estimadas' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.numero.trim()) { setError('El número es obligatorio'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave({
        ...data,
        horas_estimadas: data.horas_estimadas === '' ? null as unknown as number : Number(data.horas_estimadas),
        proyecto_id: data.proyecto_id || null as unknown as string,
        subcontratista_id: data.subcontratista_id || null as unknown as string,
        fecha_inicio: data.fecha_inicio || null as unknown as string,
        fecha_fin: data.fecha_fin || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar orden de trabajo' : 'Nueva orden de trabajo'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="orden-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="orden-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Número *" value={form.numero} onChange={set('numero')} placeholder="OT-2024-001" />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'asignada',   label: 'Asignada' },
            { value: 'en_curso',   label: 'En curso' },
            { value: 'completada', label: 'Completada' },
            { value: 'firmada',    label: 'Firmada' },
          ]} />
          <Select label="Proyecto" value={form.proyecto_id} onChange={set('proyecto_id')} placeholder="Sin proyecto"
            options={proyectos.map(p => ({ value: p.id, label: `${p.codigo} — ${p.nombre}` }))} />
          <Select label="Subcontratista asignado" value={form.subcontratista_id} onChange={set('subcontratista_id')} placeholder="Sin asignar"
            options={subcontratistas.length > 0
              ? subcontratistas.map(u => ({ value: u.id, label: `${u.nombre ?? ''} ${u.apellidos ?? ''}`.trim() || u.email }))
              : [{ value: '', label: 'No hay subcontratistas registrados' }]
            } />
          <Input label="Localidad" value={form.localidad} onChange={set('localidad')} placeholder="Málaga" />
          <Input label="Horas estimadas" type="number" min="0" step="0.5" value={form.horas_estimadas} onChange={set('horas_estimadas')} placeholder="40" />
          <Input label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} />
          <Input label="Fecha fin prevista" type="date" value={form.fecha_fin} onChange={set('fecha_fin')} />
          <div className="col-span-2">
            <Textarea label="Descripción de trabajos" value={form.descripcion} onChange={set('descripcion')}
              placeholder="Descripción detallada de los trabajos a realizar..." rows={3} />
          </div>
          <div className="col-span-2">
            <Textarea label="Notas" value={form.notas} onChange={set('notas')} placeholder="Condiciones, materiales incluidos, etc." rows={2} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
