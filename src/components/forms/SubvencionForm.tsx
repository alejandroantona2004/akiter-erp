import { useState, type FormEvent } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useCrud } from '../../hooks/useCrud'

export interface SubvencionData {
  id?: string
  nombre: string
  organismo: string
  cliente_id: string
  importe: number | ''
  estado: string
  fecha_solicitud: string
  fecha_resolucion: string
  notas: string
}

const empty: SubvencionData = {
  nombre: '', organismo: '', cliente_id: '', importe: '',
  estado: 'identificada', fecha_solicitud: '', fecha_resolucion: '', notas: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<SubvencionData, 'id'>) => Promise<void>
  initial?: SubvencionData | null
}

export function SubvencionForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<SubvencionData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: clientes } = useCrud<{ id: string; nombre: string }>(
    'akiter_clientes', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre' }
  )

  const set = (field: keyof SubvencionData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({
        ...prev,
        [field]: field === 'importe' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value,
      }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave({
        ...data,
        importe: data.importe === '' ? null as unknown as number : Number(data.importe),
        cliente_id: data.cliente_id || null as unknown as string,
        fecha_solicitud: data.fecha_solicitud || null as unknown as string,
        fecha_resolucion: data.fecha_resolucion || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar subvención' : 'Nueva subvención'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="subvencion-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="subvencion-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Nombre del programa / subvención *" value={form.nombre} onChange={set('nombre')}
              placeholder="Programa MOVES III, Kit Digital..." />
          </div>
          <Input label="Organismo convocante" value={form.organismo} onChange={set('organismo')}
            placeholder="IDAE, Junta de Andalucía, Ministerio..." />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'identificada', label: 'Identificada' },
            { value: 'solicitada',   label: 'Solicitada' },
            { value: 'en_tramite',   label: 'En trámite' },
            { value: 'aprobada',     label: 'Aprobada' },
            { value: 'denegada',     label: 'Denegada' },
            { value: 'cobrada',      label: 'Cobrada' },
          ]} />
          <Select label="Cliente beneficiario" value={form.cliente_id} onChange={set('cliente_id')}
            placeholder="Sin cliente" options={clientes.map(c => ({ value: c.id, label: c.nombre }))} />
          <Input label="Importe (€)" type="number" min="0" step="0.01" value={form.importe}
            onChange={set('importe')} placeholder="12000" />
          <Input label="Fecha solicitud" type="date" value={form.fecha_solicitud} onChange={set('fecha_solicitud')} />
          <Input label="Fecha resolución" type="date" value={form.fecha_resolucion} onChange={set('fecha_resolucion')} />
          <div className="col-span-2">
            <Textarea label="Notas" value={form.notas} onChange={set('notas')}
              placeholder="Requisitos, documentación pendiente, observaciones..." rows={2} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
