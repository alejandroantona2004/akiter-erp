import { useState, type FormEvent } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Input'
import { Select } from '../ui/Select'
import { Textarea } from '../ui/Textarea'
import { Button } from '../ui/Button'
import { useCrud } from '../../hooks/useCrud'

interface LineaPresupuesto {
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
}

export interface PresupuestoData {
  id?: string
  numero: string
  cliente_id: string
  descripcion: string
  iva_porcentaje: number
  estado: string
  fecha_emision: string
  fecha_validez: string
  notas: string
  lineas: LineaPresupuesto[]
}

const emptyLinea = (): LineaPresupuesto => ({ descripcion: '', cantidad: 1, precio_unitario: 0, total: 0 })

const empty: PresupuestoData = {
  numero: '', cliente_id: '', descripcion: '', iva_porcentaje: 21,
  estado: 'borrador', fecha_emision: new Date().toISOString().slice(0, 10),
  fecha_validez: '', notas: '', lineas: [emptyLinea()],
}

interface Props {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<PresupuestoData, 'id'>) => Promise<void>
  initial?: PresupuestoData | null
}

export function PresupuestoForm({ open, onClose, onSave, initial }: Props) {
  const [form, setForm] = useState<PresupuestoData>(initial ?? empty)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { data: clientes } = useCrud<{ id: string; nombre: string }>('akiter_clientes', { orderBy: 'nombre', orderAsc: true, select: 'id,nombre' })

  const set = (field: keyof Omit<PresupuestoData, 'lineas' | 'id'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: ['iva_porcentaje'].includes(field) ? Number(e.target.value) : e.target.value }))

  const updateLinea = (idx: number, field: keyof LineaPresupuesto, val: string) => {
    setForm(prev => {
      const lineas = [...prev.lineas]
      const linea = { ...lineas[idx], [field]: ['descripcion'].includes(field) ? val : Number(val) }
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
      const { id: _, lineas, ...rest } = form
      await onSave({
        ...rest,
        lineas,
        cliente_id: rest.cliente_id || null as unknown as string,
        fecha_validez: rest.fecha_validez || null as unknown as string,
        // base_imponible is computed from lineas on save
      } as unknown as Omit<PresupuestoData, 'id'>)
      onClose()
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar presupuesto' : 'Nuevo presupuesto'} size="xl"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
        <Button form="pres-form" type="submit" loading={loading}>Guardar</Button>
      </>}
    >
      <form id="pres-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Número *" value={form.numero} onChange={set('numero')} placeholder="PRE-2024-001" />
          <Select label="Cliente" value={form.cliente_id} onChange={set('cliente_id')} placeholder="Sin cliente"
            options={clientes.map(c => ({ value: c.id, label: c.nombre }))} />
          <Input label="Descripción / Objeto" value={form.descripcion} onChange={set('descripcion')} placeholder="Instalación fotovoltaica..." className="col-span-2" />
          <Input label="Fecha emisión" type="date" value={form.fecha_emision} onChange={set('fecha_emision')} />
          <Input label="Válido hasta" type="date" value={form.fecha_validez} onChange={set('fecha_validez')} />
          <Select label="Estado" value={form.estado} onChange={set('estado')} options={[
            { value: 'borrador', label: 'Borrador' },
            { value: 'enviado', label: 'Enviado' },
            { value: 'aceptado', label: 'Aceptado' },
            { value: 'rechazado', label: 'Rechazado' },
            { value: 'expirado', label: 'Expirado' },
          ]} />
          <Input label="IVA (%)" type="number" min="0" max="100" value={form.iva_porcentaje} onChange={set('iva_porcentaje')} />
        </div>

        {/* Line items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Líneas</p>
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
                      <input
                        className="w-full border-0 bg-transparent focus:outline-none text-sm"
                        placeholder="Descripción del trabajo o material..."
                        value={linea.descripcion}
                        onChange={e => updateLinea(idx, 'descripcion', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="w-full border-0 bg-transparent focus:outline-none text-sm text-right"
                        value={linea.cantidad}
                        onChange={e => updateLinea(idx, 'cantidad', e.target.value)}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number" min="0" step="0.01"
                        className="w-full border-0 bg-transparent focus:outline-none text-sm text-right"
                        value={linea.precio_unitario}
                        onChange={e => updateLinea(idx, 'precio_unitario', e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right font-medium text-gray-900">
                      {linea.total.toFixed(2)}
                    </td>
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

          {/* Totals */}
          <div className="mt-3 space-y-1 text-sm text-right">
            <p className="text-gray-600">Base imponible: <span className="font-medium text-gray-900">{baseImponible.toFixed(2)} €</span></p>
            <p className="text-gray-600">IVA ({form.iva_porcentaje}%): <span className="font-medium text-gray-900">{importeIva.toFixed(2)} €</span></p>
            <p className="text-base font-bold text-[#1a4a2e]">Total: {total.toFixed(2)} €</p>
          </div>
        </div>

        <Textarea label="Notas / Condiciones" value={form.notas} onChange={set('notas')} placeholder="Condiciones del presupuesto, plazos, garantías..." rows={2} />
      </form>
    </Modal>
  )
}
