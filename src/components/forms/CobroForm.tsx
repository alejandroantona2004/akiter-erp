import { useState, type FormEvent, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useCrud } from '../../hooks/useCrud'

export interface CobroData {
  id?: string
  numero: string
  factura_id: string
  cliente_id: string
  importe: number | ''
  fecha_cobro: string
  forma_pago: string
  referencia: string
  notas: string
}

const empty: CobroData = {
  numero: '', factura_id: '', cliente_id: '', importe: '',
  fecha_cobro: new Date().toISOString().slice(0, 10),
  forma_pago: 'transferencia', referencia: '', notas: '',
}

interface Factura { id: string; numero: string; total: number; cliente_id: string }

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<CobroData, 'id'>) => Promise<void>
  initial?: CobroData | null
}

export function CobroForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<CobroData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: facturas } = useCrud<Factura>('akiter_facturas', {
    orderBy: 'created_at', orderAsc: false, select: 'id,numero,total,cliente_id',
  })
  const { data: clientes } = useCrud<{ id: string; nombre: string }>('akiter_clientes', {
    orderBy: 'nombre', orderAsc: true, select: 'id,nombre',
  })

  // Auto-fill importe and cliente_id when a factura is selected
  useEffect(() => {
    if (!form.factura_id) return
    const factura = facturas.find(f => f.id === form.factura_id)
    if (factura) {
      setForm(prev => ({
        ...prev,
        importe: factura.total ?? prev.importe,
        cliente_id: factura.cliente_id ?? prev.cliente_id,
      }))
    }
  }, [form.factura_id, facturas])

  const set = (field: keyof CobroData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: field === 'importe' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.importe && form.importe !== 0) { setError('El importe es obligatorio'); return }
    if (!form.fecha_cobro) { setError('La fecha de cobro es obligatoria'); return }
    setLoading(true); setError('')
    try {
      const { id: _, ...data } = form
      await onSave({
        ...data,
        importe: Number(data.importe),
        factura_id: data.factura_id || null as unknown as string,
        cliente_id: data.cliente_id || null as unknown as string,
        numero: data.numero || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar cobro' : 'Registrar cobro'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="cobro-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="cobro-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Nº referencia interna" value={form.numero} onChange={set('numero')} placeholder="COB-2024-001" />
          <Input label="Fecha de cobro *" type="date" value={form.fecha_cobro} onChange={set('fecha_cobro')} />
          <div className="col-span-2">
            <Select label="Factura asociada" value={form.factura_id} onChange={set('factura_id')} placeholder="Sin factura"
              options={facturas.map(f => ({ value: f.id, label: `${f.numero} — ${Number(f.total ?? 0).toLocaleString('es-ES')} €` }))} />
          </div>
          <div className="col-span-2">
            <Select label="Cliente" value={form.cliente_id} onChange={set('cliente_id')} placeholder="Sin cliente"
              options={clientes.map(c => ({ value: c.id, label: c.nombre }))} />
          </div>
          <Input label="Importe cobrado (€) *" type="number" min="0" step="0.01" value={form.importe} onChange={set('importe')} />
          <Select label="Forma de pago" value={form.forma_pago} onChange={set('forma_pago')} options={[
            { value: 'transferencia', label: 'Transferencia bancaria' },
            { value: 'efectivo',      label: 'Efectivo' },
            { value: 'cheque',        label: 'Cheque' },
            { value: 'tarjeta',       label: 'Tarjeta' },
            { value: 'otro',          label: 'Otro' },
          ]} />
          <div className="col-span-2">
            <Input label="Referencia bancaria / justificante" value={form.referencia} onChange={set('referencia')} placeholder="ES12 0000 0000 0000 0000 0000" />
          </div>
          <div className="col-span-2">
            <Textarea label="Notas" value={form.notas} onChange={set('notas')} placeholder="Observaciones..." rows={2} />
          </div>
        </div>
      </form>
    </Modal>
  )
}
