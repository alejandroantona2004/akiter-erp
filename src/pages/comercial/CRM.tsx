import { useState } from 'react'
import { Plus, Search, Phone, Mail, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { LeadForm, type LeadData } from '../../components/forms/LeadForm'
import { useCrud } from '../../hooks/useCrud'

interface Lead extends LeadData {
  id: string
  created_at: string
}

const ETAPAS = ['nuevo', 'contactado', 'propuesta', 'negociacion', 'ganado', 'perdido'] as const

const etapaConfig = {
  nuevo:       { label: 'Nuevo',       color: 'bg-gray-100',   badge: 'gray' as const },
  contactado:  { label: 'Contactado',  color: 'bg-blue-50',    badge: 'blue' as const },
  propuesta:   { label: 'Propuesta',   color: 'bg-amber-50',   badge: 'gold' as const },
  negociacion: { label: 'Negociación', color: 'bg-orange-50',  badge: 'orange' as const },
  ganado:      { label: 'Ganado',      color: 'bg-green-50',   badge: 'green' as const },
  perdido:     { label: 'Perdido',     color: 'bg-red-50',     badge: 'red' as const },
}

export function CRM() {
  const { data: leads, loading, create, update, remove } = useCrud<Lead>('akiter_crm_leads', {
    orderBy: 'created_at', orderAsc: false,
  })

  const [search, setSearch] = useState('')
  const [view, setView] = useState<'kanban' | 'lista'>('kanban')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Lead | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null)
  const [deleting, setDeleting] = useState(false)

  const filtered = leads.filter(l =>
    l.nombre.toLowerCase().includes(search.toLowerCase()) ||
    l.empresa?.toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setFormOpen(true) }
  const openEdit = (l: Lead) => { setEditing(l); setFormOpen(true) }

  const handleSave = async (data: Omit<LeadData, 'id'>) => {
    if (editing) {
      await update(editing.id, data)
    } else {
      await create(data as Omit<Lead, 'id' | 'created_at' | 'updated_at'>)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await remove(deleteTarget.id)
    setDeleting(false)
    setDeleteTarget(null)
  }

  const moveEtapa = async (lead: Lead, etapa: string) => {
    await update(lead.id, { etapa })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">CRM — Pipeline de ventas</h2>
          <p className="text-sm text-gray-500">{leads.length} oportunidades</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['kanban', 'lista'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium capitalize cursor-pointer transition-colors ${view === v ? 'bg-[#1a4a2e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                {v}
              </button>
            ))}
          </div>
          <Button onClick={openCreate}><Plus size={16} /> Nuevo lead</Button>
        </div>
      </div>

      <div className="max-w-xs">
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} icon={<Search size={16} />} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#1a4a2e] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : view === 'kanban' ? (
        /* Kanban */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS.map(etapa => {
            const col = filtered.filter(l => l.etapa === etapa)
            const total = col.reduce((s, l) => s + (l.valor ?? 0), 0)
            const cfg = etapaConfig[etapa]
            return (
              <div key={etapa} className="flex-shrink-0 w-64">
                <div className={`rounded-t-xl p-3 ${cfg.color} flex items-center justify-between`}>
                  <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                  <Badge variant={cfg.badge}>{col.length}</Badge>
                </div>
                <div className="bg-gray-50 rounded-b-xl p-2 space-y-2 min-h-32">
                  {col.map(lead => (
                    <div key={lead.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm hover:shadow transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{lead.nombre}</p>
                          <p className="text-xs text-gray-500 truncate">{lead.empresa}</p>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0 ml-1">
                          <button onClick={() => openEdit(lead)} className="p-1 rounded text-gray-300 hover:text-gray-600 cursor-pointer"><Pencil size={11} /></button>
                          <button onClick={() => setDeleteTarget(lead)} className="p-1 rounded text-gray-300 hover:text-red-500 cursor-pointer"><Trash2 size={11} /></button>
                        </div>
                      </div>
                      <p className="text-sm font-semibold text-[#1a4a2e] mt-2">{(lead.valor ?? 0).toLocaleString('es-ES')} €</p>
                      <div className="flex items-center justify-between mt-2 gap-1">
                        <div className="flex gap-1">
                          {lead.telefono && <a href={`tel:${lead.telefono}`} className="p-1 rounded text-gray-400 hover:text-gray-700"><Phone size={12} /></a>}
                          {lead.email && <a href={`mailto:${lead.email}`} className="p-1 rounded text-gray-400 hover:text-gray-700"><Mail size={12} /></a>}
                        </div>
                        {/* Quick stage move */}
                        <select
                          value={lead.etapa}
                          onChange={e => moveEtapa(lead, e.target.value)}
                          className="text-xs border-0 bg-transparent text-gray-400 focus:outline-none cursor-pointer"
                        >
                          {ETAPAS.map(e => <option key={e} value={e}>{etapaConfig[e].label}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                  {col.length > 0 && (
                    <p className="text-xs text-center text-gray-400 pt-1">{total.toLocaleString('es-ES')} €</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* Lista */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nombre', 'Empresa', 'Email', 'Etapa', 'Valor', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(lead => (
                <tr key={lead.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.empresa}</td>
                  <td className="px-4 py-3 text-gray-500">{lead.email}</td>
                  <td className="px-4 py-3"><Badge variant={etapaConfig[lead.etapa as keyof typeof etapaConfig]?.badge ?? 'gray'}>{etapaConfig[lead.etapa as keyof typeof etapaConfig]?.label ?? lead.etapa}</Badge></td>
                  <td className="px-4 py-3 font-semibold text-[#1a4a2e]">{(lead.valor ?? 0).toLocaleString('es-ES')} €</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(lead)} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTarget(lead)} className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No se encontraron leads</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <LeadForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        initial={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Eliminar lead"
        message={`¿Eliminar "${deleteTarget?.nombre}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  )
}
