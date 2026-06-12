import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useCrud } from '../../hooks/useCrud'

interface LineaFactura {
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
}

export interface FacturaData {
  id?: string
  numero: string
  cliente_id: string
  presupuesto_id: string
  concepto: string
  iva_porcentaje: number
  estado: string
  fecha_emision: string
  fecha_vencimiento: string
  notas: string
  lineas: LineaFactura[]
  // stored/computed
  base_imponible?: number
  total?: number
}

const emptyLinea = (): LineaFactura => ({ descripcion: '', cantidad: 1, precio_unitario: 0, total: 0 })

const empty: FacturaData = {
  numero: '', cliente_id: '', presupuesto_id: '', concepto: '',
  iva_porcentaje: 21, estado: 'borrador',
  fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_vencimiento: '', notas: '', lineas: [emptyLinea()],
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<FacturaData, 'id'>) => Promise<void>
  initial?: FacturaData | null
}

export function FacturaForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<FacturaData>(() => ({
    ...empty,
    ...initial,
    lineas: initial?.lineas?.length ? initial.lineas : [emptyLinea()],
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const { data: clientes } = useCrud<{ id: string; nombre: string }>('akiter_clientes', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre' })
  const { data: presupuestos } = useCrud<{ id: string; numero: string; cliente_id: string }>('akiter_presupuestos', { orderBy: 'created_at', select: 'id,numero,cliente_id' })

  const filteredPresupuestos = form.cliente_id
    ? presupuestos.filter(p => p.cliente_id === form.cliente_id)
    : presupuestos

  const set = (field: keyof Omit<FacturaData, 'lineas' | 'id' | 'base_imponible' | 'total'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: field === 'iva_porcentaje' ? Number(e.target.value) : e.target.value }))

  const updateLinea = (idx: number, field: keyof LineaFactura, val: string) => {
    setForm(prev => {
      const lineas = [...prev.lineas]
      const linea = { ...lineas[idx], [field]: field === 'descripcion' ? val : Number(val) }
      linea.total = linea.cantidad * linea.precio_unitario
      lineas[idx] = linea
      return { ...prev, lineas }
    })
  }

  const addLinea = () => setForm(prev => ({ ...prev, lineas: [...prev.lineas, emptyLinea()] }))
  const removeLinea = (idx: number) => setForm(prev => ({ ...prev, lineas: prev.lineas.filter((_, i) => i !== idx) }))

  const baseImponible = form.lineas.reduce((s, l) => s + l.total, 0)
  const importeIva = baseImponible * form.iva_porcentaje / 100
  const total = baseImponible + importeIva

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.numero.trim()) { setError('El número es obligatorio'); return }
    setLoading(true); setError('')
    try {
      const { id: _, base_imponible: _b, total: _t, ...rest } = form
      await onSave({
        ...rest,
        base_imponible: baseImponible,
        total,
        cliente_id: rest.cliente_id || null as unknown as string,
        presupuesto_id: rest.presupuesto_id || null as unknown as string,
        fecha_vencimiento: rest.fecha_vencimiento || null as unknown as string,
      })
      onClose()
    } catch (e: unknown) { setError((e as Error).message) }
    finally { setLoading(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar factura' : 'Nueva factura'} size="xl"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="factura-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="factura-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Número factura *" value={form.numero} onChange={set('numero')} placeholder="FAC-2024-001" />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'borrador', label: 'Borrador' },
            { value: 'emitida',  label: 'Emitida' },
            { value: 'cobrada',  label: 'Cobrada' },
            { value: 'vencida',  label: 'Vencida' },
          ]} />
          <Select label="Cliente" value={form.cliente_id} onChange={set('cliente_id')} placeholder="Sin cliente"
            options={clientes.map(c => ({ value: c.id, label: c.nombre }))} />
          <Select label="Presupuesto origen" value={form.presupuesto_id} onChange={set('presupuesto_id')} placeholder="Sin presupuesto"
            options={filteredPresupuestos.map(p => ({ value: p.id, label: p.numero }))} />
          <div className="col-span-2">
            <Input label="Concepto / Objeto de la factura" value={form.concepto} onChange={set('concepto')} placeholder="Instalación Solar — Certificación 1" />
          </div>
          <Input label="Fecha emisión" type="date" value={form.fecha_emision} onChange={set('fecha_emision')} />
          <Input label="Fecha vencimiento" type="date" value={form.fecha_vencimiento} onChange={set('fecha_vencimiento')} />
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Líneas de factura</p>
            <Button type="button" size="sm" variant="secondary" onClick={addLinea}><Plus size={14} /> Añadir línea</Button>
          </div>
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">Descripción</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 w-20">Cant.</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 w-28">P. Unit. (€)</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500 w-28">Total (€)</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {form.lineas.map((linea, idx) => (
                  <tr key={idx} className="bg-white">
                    <td className="px-2 py-1.5">
                      <input className="w-full border-0 bg-transparent focus:outline-none text-sm"
                        placeholder="Concepto..." value={linea.descripcion}
                        onChange={e => updateLinea(idx, 'descripcion', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={linea.cantidad}
                        className="w-full border-0 bg-transparent focus:outline-none text-sm text-right"
                        onChange={e => updateLinea(idx, 'cantidad', e.target.value)} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input type="number" min="0" step="0.01" value={linea.precio_unitario}
                        className="w-full border-0 bg-transparent focus:outline-none text-sm text-right"
                        onChange={e => updateLinea(idx, 'precio_unitario', e.target.value)} />
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900">{linea.total.toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {form.lineas.length > 1 && (
                        <button type="button" onClick={() => removeLinea(idx)} className="text-gray-300 hover:text-red-500 cursor-pointer">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 space-y-1 text-sm text-right">
            <div className="flex items-center justify-end gap-4">
              <Input label="IVA (%)" type="number" min="0" max="100" value={form.iva_porcentaje}
                onChange={set('iva_porcentaje')} className="w-24 text-right" />
            </div>
            <p className="text-gray-600">Base imponible: <span className="font-medium text-gray-900">{baseImponible.toFixed(2)} €</span></p>
            <p className="text-gray-600">IVA ({form.iva_porcentaje}%): <span className="font-medium text-gray-900">{importeIva.toFixed(2)} €</span></p>
            <p className="text-base font-bold text-[#1a4a2e]">Total: {total.toFixed(2)} €</p>
          </div>
        </div>

        <Textarea label="Notas" value={form.notas} onChange={set('notas')} placeholder="Observaciones..." rows={2} />
      </form>
    </Modal>
  )
}
