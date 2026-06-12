import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

export const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY as string,
  dangerouslyAllowBrowser: true,
})

export const AI_MODEL = 'claude-sonnet-4-6'

// ─── Verified column map (from supabase_schema.sql) ──────────────────────────
//
// akiter_clientes:     id, nombre, cif, email, telefono, localidad, provincia,
//                      direccion, estado (activo|inactivo|potencial), notas,
//                      created_by, created_at, updated_at
//
// akiter_crm_leads:    id, nombre, empresa, email, telefono,
//                      etapa (nuevo|contactado|propuesta|negociacion|ganado|perdido),
//                      valor, asignado_id, notas, created_at, updated_at
//
// akiter_proyectos:    id, codigo (UNIQUE NOT NULL — no editable), nombre, cliente_id,
//                      responsable_id, localidad, descripcion,
//                      estado (planificacion|en_curso|pausado|finalizado|cancelado),
//                      progreso (0-100), presupuesto, fecha_inicio, fecha_fin,
//                      created_at, updated_at
//
// akiter_presupuestos: id, numero, cliente_id, descripcion, base_imponible,
//                      iva_porcentaje, importe_iva (generated), total (generated),
//                      estado, fecha_emision, fecha_validez, notas, created_by, created_at
//
// akiter_facturas:     id, numero, cliente_id, presupuesto_id, concepto,
//                      base_imponible, iva_porcentaje, total, estado,
//                      fecha_emision, fecha_vencimiento, notas, created_at
//
// akiter_inventario:   id, referencia (UNIQUE NOT NULL), nombre, categoria, stock,
//                      stock_minimo, unidad, precio_unitario, ubicacion, proveedor_id,
//                      updated_at
//                      ✗ stock_actual  ✗ precio_venta  ✗ descripcion
//
// akiter_proveedores:  id, nombre, cif, categoria, contacto, email, telefono,
//                      localidad, estado (activo|inactivo), notas, created_at
//                      ✗ direccion  ✗ ciudad  (use localidad instead)
//
// akiter_partes_trabajo: id, numero, proyecto_id, tecnico_id, fecha, horas,
//                        descripcion, estado, firma_cliente, notas, created_at
//
// akiter_ordenes_trabajo: id, numero, proyecto_id, subcontratista_id, descripcion,
//                         localidad, fecha_inicio, fecha_fin, horas_estimadas,
//                         estado, notas, created_at
//
// akiter_cobros:       id, numero, factura_id, cliente_id, importe, fecha_cobro,
//                      forma_pago, referencia, notas, created_by, created_at

// ─── Session undo stack (max 10, module-level — resets on page refresh) ───────

interface UndoEntry {
  action: string
  table: string
  entityId: string
  operation: 'create' | 'update' | 'delete' | 'stock'
  prevValues: Record<string, unknown>
}

const _undo: UndoEntry[] = []

function pushUndo(e: UndoEntry) {
  _undo.unshift(e)
  if (_undo.length > 10) _undo.pop()
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

export const WRITE_TOOLS: Anthropic.Tool[] = [
  // ── Crear ────────────────────────────────────────────────────────────────
  {
    name: 'crear_lead',
    description: 'Crea un nuevo lead u oportunidad de venta en el CRM (tabla akiter_crm_leads)',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre:   { type: 'string', description: 'Nombre de la persona de contacto (obligatorio)' },
        empresa:  { type: 'string' },
        email:    { type: 'string' },
        telefono: { type: 'string' },
        etapa: { type: 'string', enum: ['nuevo','contactado','propuesta','negociacion','ganado','perdido'] },
        valor: { type: 'number', description: 'Valor estimado en euros' },
        notas: { type: 'string' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'crear_cliente',
    description: 'Crea un nuevo cliente en el sistema (tabla akiter_clientes)',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre:    { type: 'string', description: 'Nombre o razón social (obligatorio)' },
        cif:       { type: 'string', description: 'CIF o NIF' },
        email:     { type: 'string' },
        telefono:  { type: 'string' },
        localidad: { type: 'string' },
        provincia: { type: 'string' },
        direccion: { type: 'string' },
        notas:     { type: 'string' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'crear_proveedor',
    description: 'Crea un nuevo proveedor en el sistema (tabla akiter_proveedores). Nota: la columna de localización se llama "localidad", no "direccion" ni "ciudad".',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre:    { type: 'string', description: 'Nombre del proveedor (obligatorio)' },
        cif:       { type: 'string' },
        categoria: { type: 'string', description: 'Categoría (ej: "Paneles", "Inversores", "Fontanería")' },
        contacto:  { type: 'string', description: 'Nombre de la persona de contacto' },
        email:     { type: 'string' },
        telefono:  { type: 'string' },
        localidad: { type: 'string', description: 'Ciudad o localidad del proveedor (no existe columna "direccion")' },
        notas:     { type: 'string' },
      },
      required: ['nombre'],
    },
  },
  {
    name: 'crear_producto_inventario',
    description: 'Crea un nuevo producto en el catálogo de inventario (tabla akiter_inventario). Úsalo cuando un albarán mencione un artículo que no existe todavía.',
    input_schema: {
      type: 'object' as const,
      properties: {
        nombre:          { type: 'string', description: 'Nombre descriptivo (obligatorio)' },
        referencia:      { type: 'string', description: 'Código de referencia único. Obligatorio. Si no aparece en el documento, inventa un código corto (ej: "PS-400W").' },
        categoria:       { type: 'string' },
        stock:           { type: 'number', description: 'Stock inicial. Por defecto 0.' },
        stock_minimo:    { type: 'number', description: 'Nivel mínimo de alerta. Por defecto 0.' },
        precio_unitario: { type: 'number' },
        unidad:          { type: 'string', description: 'Unidad de medida (ud, m, m², kg, rollo…)' },
        ubicacion:       { type: 'string' },
      },
      required: ['nombre', 'referencia'],
    },
  },

  // ── Actualizar ───────────────────────────────────────────────────────────
  {
    name: 'actualizar_estado',
    description: 'Actualiza solo el campo estado/etapa de un proyecto, factura, lead, presupuesto, parte u orden. Para actualizar otros campos usa las herramientas actualizar_* específicas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        entidad: { type: 'string', enum: ['proyecto','factura','lead','presupuesto','parte','orden'] },
        id: { type: 'string', description: 'UUID de la entidad' },
        nuevo_estado: { type: 'string', description: 'Nuevo estado. Proyectos: planificacion|en_curso|pausado|finalizado|cancelado. Facturas: borrador|emitida|cobrada|vencida. Leads: nuevo|contactado|propuesta|negociacion|ganado|perdido. Presupuestos: borrador|enviado|aceptado|rechazado|expirado. Partes: borrador|pendiente_firma|firmado|facturado. Órdenes: asignada|en_curso|completada|firmada' },
      },
      required: ['entidad', 'id', 'nuevo_estado'],
    },
  },
  {
    name: 'actualizar_cliente',
    description: 'Actualiza uno o varios campos de un cliente existente (tabla akiter_clientes). Solo incluye los campos que quieres cambiar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:        { type: 'string', description: 'UUID del cliente (obligatorio)' },
        nombre:    { type: 'string' },
        cif:       { type: 'string' },
        email:     { type: 'string' },
        telefono:  { type: 'string' },
        localidad: { type: 'string' },
        provincia: { type: 'string' },
        direccion: { type: 'string' },
        estado:    { type: 'string', enum: ['activo','inactivo','potencial'] },
        notas:     { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'actualizar_lead',
    description: 'Actualiza uno o varios campos de un lead existente (tabla akiter_crm_leads). Solo incluye los campos que quieres cambiar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:       { type: 'string', description: 'UUID del lead (obligatorio)' },
        nombre:   { type: 'string' },
        empresa:  { type: 'string' },
        email:    { type: 'string' },
        telefono: { type: 'string' },
        etapa:    { type: 'string', enum: ['nuevo','contactado','propuesta','negociacion','ganado','perdido'] },
        valor:    { type: 'number' },
        notas:    { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'actualizar_proveedor',
    description: 'Actualiza uno o varios campos de un proveedor existente (tabla akiter_proveedores). Solo incluye los campos que quieres cambiar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:        { type: 'string', description: 'UUID del proveedor (obligatorio)' },
        nombre:    { type: 'string' },
        cif:       { type: 'string' },
        categoria: { type: 'string' },
        contacto:  { type: 'string' },
        email:     { type: 'string' },
        telefono:  { type: 'string' },
        localidad: { type: 'string' },
        estado:    { type: 'string', enum: ['activo','inactivo'] },
        notas:     { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'actualizar_proyecto',
    description: 'Actualiza uno o varios campos de un proyecto existente (tabla akiter_proyectos). No se puede cambiar el código. Solo incluye los campos que quieres cambiar.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:          { type: 'string', description: 'UUID del proyecto (obligatorio)' },
        nombre:      { type: 'string' },
        localidad:   { type: 'string' },
        descripcion: { type: 'string' },
        estado:      { type: 'string', enum: ['planificacion','en_curso','pausado','finalizado','cancelado'] },
        progreso:    { type: 'number', description: 'Porcentaje de progreso (0-100)' },
        presupuesto: { type: 'number' },
        fecha_inicio: { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
        fecha_fin:   { type: 'string', description: 'Fecha en formato YYYY-MM-DD' },
      },
      required: ['id'],
    },
  },
  {
    name: 'registrar_movimiento_inventario',
    description: 'Registra entrada, salida o ajuste de stock para un producto EXISTENTE. Usa crear_producto_inventario primero si el producto no existe.',
    input_schema: {
      type: 'object' as const,
      properties: {
        producto_id: { type: 'string', description: 'UUID del producto en akiter_inventario' },
        tipo:        { type: 'string', enum: ['entrada','salida','ajuste'] },
        cantidad:    { type: 'number', description: 'Unidades (para ajuste: valor final absoluto)' },
        motivo:      { type: 'string' },
      },
      required: ['producto_id', 'tipo', 'cantidad'],
    },
  },

  // ── Eliminar ─────────────────────────────────────────────────────────────
  {
    name: 'eliminar_cliente',
    description: 'Elimina un cliente del sistema (tabla akiter_clientes). Acción irreversible salvo deshacer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:     { type: 'string', description: 'UUID del cliente (obligatorio)' },
        nombre: { type: 'string', description: 'Nombre del cliente (para mostrar en confirmación)' },
      },
      required: ['id', 'nombre'],
    },
  },
  {
    name: 'eliminar_lead',
    description: 'Elimina un lead del CRM (tabla akiter_crm_leads). Acción irreversible salvo deshacer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:     { type: 'string', description: 'UUID del lead (obligatorio)' },
        nombre: { type: 'string', description: 'Nombre del lead (para mostrar en confirmación)' },
      },
      required: ['id', 'nombre'],
    },
  },
  {
    name: 'eliminar_proveedor',
    description: 'Elimina un proveedor del sistema (tabla akiter_proveedores). Acción irreversible salvo deshacer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:     { type: 'string', description: 'UUID del proveedor (obligatorio)' },
        nombre: { type: 'string', description: 'Nombre del proveedor (para mostrar en confirmación)' },
      },
      required: ['id', 'nombre'],
    },
  },
  {
    name: 'eliminar_producto_inventario',
    description: 'Elimina un producto del catálogo de inventario (tabla akiter_inventario). Acción irreversible salvo deshacer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:     { type: 'string', description: 'UUID del producto (obligatorio)' },
        nombre: { type: 'string', description: 'Nombre del producto (para mostrar en confirmación)' },
      },
      required: ['id', 'nombre'],
    },
  },
  {
    name: 'eliminar_proyecto',
    description: 'Elimina un proyecto del sistema (tabla akiter_proyectos). Acción irreversible salvo deshacer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        id:     { type: 'string', description: 'UUID del proyecto (obligatorio)' },
        nombre: { type: 'string', description: 'Nombre del proyecto (para mostrar en confirmación)' },
      },
      required: ['id', 'nombre'],
    },
  },

  // ── Deshacer ─────────────────────────────────────────────────────────────
  {
    name: 'deshacer_ultima_accion',
    description: 'Revierte la última acción de escritura realizada en esta sesión. Úsalo cuando el usuario diga "deshacer", "no era eso", "deshaz eso", "cambialo", "error", "perdona", "equivocado", etc. Puede revertir hasta las últimas 10 acciones.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
]

// ─── Human-readable description (shown in confirmation dialog) ────────────────

export function describeAction(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'crear_lead':
      return `Crear lead: **${input.nombre}**${input.empresa ? ` — ${input.empresa}` : ''}${input.valor ? ` (${Number(input.valor).toLocaleString('es-ES')} €)` : ''}`
    case 'crear_cliente':
      return `Crear cliente: **${input.nombre}**${input.localidad ? ` · ${input.localidad}` : ''}${input.cif ? ` · CIF: ${input.cif}` : ''}`
    case 'crear_proveedor':
      return `Crear proveedor: **${input.nombre}**${input.categoria ? ` · ${input.categoria}` : ''}${input.localidad ? ` · ${input.localidad}` : ''}`
    case 'crear_producto_inventario':
      return `Crear producto en inventario: **${input.nombre}** · Ref: ${input.referencia}${input.stock != null ? ` · Stock inicial: ${input.stock}` : ''}${input.precio_unitario != null ? ` · ${Number(input.precio_unitario).toLocaleString('es-ES')} €/ud` : ''}`
    case 'actualizar_estado':
      return `Cambiar estado de **${input.entidad}** \`${input.id}\` → **"${input.nuevo_estado}"**`
    case 'actualizar_cliente': {
      const campos = Object.keys(input).filter(k => k !== 'id').join(', ')
      return `Actualizar cliente \`${input.id}\` — campos: **${campos}**`
    }
    case 'actualizar_lead': {
      const campos = Object.keys(input).filter(k => k !== 'id').join(', ')
      return `Actualizar lead \`${input.id}\` — campos: **${campos}**`
    }
    case 'actualizar_proveedor': {
      const campos = Object.keys(input).filter(k => k !== 'id').join(', ')
      return `Actualizar proveedor \`${input.id}\` — campos: **${campos}**`
    }
    case 'actualizar_proyecto': {
      const campos = Object.keys(input).filter(k => k !== 'id').join(', ')
      return `Actualizar proyecto \`${input.id}\` — campos: **${campos}**`
    }
    case 'registrar_movimiento_inventario':
      return `Registrar **${input.tipo}** de **${input.cantidad} unidades** (producto: \`${input.producto_id}\`)${input.motivo ? ` — ${input.motivo}` : ''}`
    case 'eliminar_cliente':
      return `⚠️ Eliminar cliente: **${input.nombre}** (\`${input.id}\`)`
    case 'eliminar_lead':
      return `⚠️ Eliminar lead: **${input.nombre}** (\`${input.id}\`)`
    case 'eliminar_proveedor':
      return `⚠️ Eliminar proveedor: **${input.nombre}** (\`${input.id}\`)`
    case 'eliminar_producto_inventario':
      return `⚠️ Eliminar producto de inventario: **${input.nombre}** (\`${input.id}\`)`
    case 'eliminar_proyecto':
      return `⚠️ Eliminar proyecto: **${input.nombre}** (\`${input.id}\`)`
    case 'deshacer_ultima_accion': {
      const entry = _undo[0]
      if (!entry) return 'Deshacer la última acción (no hay acciones recientes en esta sesión)'
      return `Deshacer: **${entry.action}**`
    }
    default:
      return `Ejecutar: ${toolName}`
  }
}

// ─── Execute confirmed write tool via Supabase ────────────────────────────────

// Builds a partial-update object including only the fields present in input
// (excluding the id field itself).
function buildUpdates(input: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of allowed) {
    if (f in input && input[f] !== undefined) out[f] = input[f]
  }
  return out
}

export async function executeWriteTool(toolName: string, input: Record<string, unknown>): Promise<string> {
  switch (toolName) {

    // ── Crear ──────────────────────────────────────────────────────────────

    case 'crear_lead': {
      const { data, error } = await supabase
        .from('akiter_crm_leads')
        .insert({
          nombre:   input.nombre,
          empresa:  input.empresa  ?? null,
          email:    input.email    ?? null,
          telefono: input.telefono ?? null,
          etapa:    (input.etapa as string) ?? 'nuevo',
          valor:    input.valor    ?? 0,
          notas:    input.notas    ?? null,
        })
        .select('id, nombre, empresa')
        .single()
      if (error) throw new Error(error.message)
      const row = data as { id: string; nombre: string; empresa: string | null }
      pushUndo({ action: `Crear lead: ${row.nombre}`, table: 'akiter_crm_leads', entityId: row.id, operation: 'create', prevValues: {} })
      return `Lead creado: ${row.nombre}${row.empresa ? ` (${row.empresa})` : ''} — ID: ${row.id}\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'crear_cliente': {
      const { data, error } = await supabase
        .from('akiter_clientes')
        .insert({
          nombre:    input.nombre,
          cif:       input.cif       ?? null,
          email:     input.email     ?? null,
          telefono:  input.telefono  ?? null,
          localidad: input.localidad ?? null,
          provincia: input.provincia ?? null,
          direccion: input.direccion ?? null,
          notas:     input.notas     ?? null,
          estado:    'activo',
        })
        .select('id, nombre')
        .single()
      if (error) throw new Error(error.message)
      const row = data as { id: string; nombre: string }
      pushUndo({ action: `Crear cliente: ${row.nombre}`, table: 'akiter_clientes', entityId: row.id, operation: 'create', prevValues: {} })
      return `Cliente creado: ${row.nombre} — ID: ${row.id}\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'crear_proveedor': {
      const { data, error } = await supabase
        .from('akiter_proveedores')
        .insert({
          nombre:    input.nombre,
          cif:       input.cif       ?? null,
          categoria: input.categoria ?? null,
          contacto:  input.contacto  ?? null,
          email:     input.email     ?? null,
          telefono:  input.telefono  ?? null,
          localidad: input.localidad ?? null,
          notas:     input.notas     ?? null,
          estado:    'activo',
        })
        .select('id, nombre')
        .single()
      if (error) throw new Error(error.message)
      const row = data as { id: string; nombre: string }
      pushUndo({ action: `Crear proveedor: ${row.nombre}`, table: 'akiter_proveedores', entityId: row.id, operation: 'create', prevValues: {} })
      return `Proveedor creado: ${row.nombre} — ID: ${row.id}\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'crear_producto_inventario': {
      const { data, error } = await supabase
        .from('akiter_inventario')
        .insert({
          nombre:          input.nombre,
          referencia:      input.referencia,
          categoria:       input.categoria       ?? null,
          stock:           input.stock           ?? 0,
          stock_minimo:    input.stock_minimo    ?? 0,
          precio_unitario: input.precio_unitario ?? null,
          unidad:          input.unidad          ?? 'ud',
          ubicacion:       input.ubicacion       ?? null,
        })
        .select('id, nombre, referencia, stock')
        .single()
      if (error) throw new Error(error.message)
      const row = data as { id: string; nombre: string; referencia: string | null; stock: number }
      pushUndo({ action: `Crear producto inventario: ${row.nombre}`, table: 'akiter_inventario', entityId: row.id, operation: 'create', prevValues: {} })
      return `Producto creado: "${row.nombre}"${row.referencia ? ` (ref: ${row.referencia})` : ''} con stock ${row.stock} — ID: ${row.id}\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    // ── Actualizar ─────────────────────────────────────────────────────────

    case 'actualizar_estado': {
      const tableMap: Record<string, string> = {
        proyecto:    'akiter_proyectos',
        factura:     'akiter_facturas',
        lead:        'akiter_crm_leads',
        presupuesto: 'akiter_presupuestos',
        parte:       'akiter_partes_trabajo',
        orden:       'akiter_ordenes_trabajo',
      }
      const tableName = tableMap[input.entidad as string]
      if (!tableName) throw new Error(`Entidad desconocida: ${input.entidad}`)
      const campoEstado = input.entidad === 'lead' ? 'etapa' : 'estado'

      // Fetch previous value for undo
      const { data: prev } = await supabase.from(tableName).select(campoEstado).eq('id', input.id).single()
      const prevVal = (prev as Record<string, unknown> | null)?.[campoEstado]

      const { error } = await supabase.from(tableName).update({ [campoEstado]: input.nuevo_estado }).eq('id', input.id)
      if (error) throw new Error(error.message)
      pushUndo({ action: `Estado ${input.entidad}: "${prevVal}" → "${input.nuevo_estado}"`, table: tableName, entityId: input.id as string, operation: 'update', prevValues: { [campoEstado]: prevVal } })
      return `${input.entidad} actualizado: ${campoEstado} → "${input.nuevo_estado}"\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'actualizar_cliente': {
      const FIELDS = ['nombre','cif','email','telefono','localidad','provincia','direccion','estado','notas']
      const updates = buildUpdates(input, FIELDS)
      if (Object.keys(updates).length === 0) throw new Error('No se proporcionaron campos a actualizar')

      const { data: prev } = await supabase.from('akiter_clientes').select(Object.keys(updates).join(',')).eq('id', input.id).single()
      const { error } = await supabase.from('akiter_clientes').update(updates).eq('id', input.id)
      if (error) throw new Error(error.message)
      pushUndo({ action: `Actualizar cliente ${input.id}: ${Object.keys(updates).join(', ')}`, table: 'akiter_clientes', entityId: input.id as string, operation: 'update', prevValues: (prev ?? {}) as Record<string, unknown> })
      return `Cliente actualizado (campos: ${Object.keys(updates).join(', ')})\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'actualizar_lead': {
      const FIELDS = ['nombre','empresa','email','telefono','etapa','valor','notas']
      const updates = buildUpdates(input, FIELDS)
      if (Object.keys(updates).length === 0) throw new Error('No se proporcionaron campos a actualizar')

      const { data: prev } = await supabase.from('akiter_crm_leads').select(Object.keys(updates).join(',')).eq('id', input.id).single()
      const { error } = await supabase.from('akiter_crm_leads').update(updates).eq('id', input.id)
      if (error) throw new Error(error.message)
      pushUndo({ action: `Actualizar lead ${input.id}: ${Object.keys(updates).join(', ')}`, table: 'akiter_crm_leads', entityId: input.id as string, operation: 'update', prevValues: (prev ?? {}) as Record<string, unknown> })
      return `Lead actualizado (campos: ${Object.keys(updates).join(', ')})\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'actualizar_proveedor': {
      const FIELDS = ['nombre','cif','categoria','contacto','email','telefono','localidad','estado','notas']
      const updates = buildUpdates(input, FIELDS)
      if (Object.keys(updates).length === 0) throw new Error('No se proporcionaron campos a actualizar')

      const { data: prev } = await supabase.from('akiter_proveedores').select(Object.keys(updates).join(',')).eq('id', input.id).single()
      const { error } = await supabase.from('akiter_proveedores').update(updates).eq('id', input.id)
      if (error) throw new Error(error.message)
      pushUndo({ action: `Actualizar proveedor ${input.id}: ${Object.keys(updates).join(', ')}`, table: 'akiter_proveedores', entityId: input.id as string, operation: 'update', prevValues: (prev ?? {}) as Record<string, unknown> })
      return `Proveedor actualizado (campos: ${Object.keys(updates).join(', ')})\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'actualizar_proyecto': {
      const FIELDS = ['nombre','localidad','descripcion','estado','progreso','presupuesto','fecha_inicio','fecha_fin']
      const updates = buildUpdates(input, FIELDS)
      if (Object.keys(updates).length === 0) throw new Error('No se proporcionaron campos a actualizar')

      const { data: prev } = await supabase.from('akiter_proyectos').select(Object.keys(updates).join(',')).eq('id', input.id).single()
      const { error } = await supabase.from('akiter_proyectos').update(updates).eq('id', input.id)
      if (error) throw new Error(error.message)
      pushUndo({ action: `Actualizar proyecto ${input.id}: ${Object.keys(updates).join(', ')}`, table: 'akiter_proyectos', entityId: input.id as string, operation: 'update', prevValues: (prev ?? {}) as Record<string, unknown> })
      return `Proyecto actualizado (campos: ${Object.keys(updates).join(', ')})\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'registrar_movimiento_inventario': {
      const { data: item, error: fetchErr } = await supabase
        .from('akiter_inventario').select('stock, nombre').eq('id', input.producto_id).single()
      if (fetchErr || !item) throw new Error('Producto no encontrado en inventario')
      const row = item as { stock: number; nombre: string }
      const qty = Number(input.cantidad)
      const prev = row.stock
      const nuevo = input.tipo === 'ajuste' ? qty : input.tipo === 'salida' ? prev - qty : prev + qty
      if (nuevo < 0) throw new Error(`Stock insuficiente: actual ${prev}, salida solicitada ${qty}`)

      const { error } = await supabase.from('akiter_inventario').update({ stock: nuevo }).eq('id', input.producto_id)
      if (error) throw new Error(error.message)
      pushUndo({ action: `Stock "${row.nombre}": ${prev} → ${nuevo}`, table: 'akiter_inventario', entityId: input.producto_id as string, operation: 'stock', prevValues: { stock: prev } })
      return `Stock de "${row.nombre}" actualizado: ${prev} → ${nuevo} unidades\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    // ── Eliminar ───────────────────────────────────────────────────────────

    case 'eliminar_cliente': {
      // Snapshot all columns before delete for potential undo
      const { data: snap } = await supabase.from('akiter_clientes').select('*').eq('id', input.id).single()
      const { error } = await supabase.from('akiter_clientes').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      if (snap) pushUndo({ action: `Eliminar cliente: ${input.nombre}`, table: 'akiter_clientes', entityId: input.id as string, operation: 'delete', prevValues: snap as Record<string, unknown> })
      return `Cliente "${input.nombre}" eliminado.\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'eliminar_lead': {
      const { data: snap } = await supabase.from('akiter_crm_leads').select('*').eq('id', input.id).single()
      const { error } = await supabase.from('akiter_crm_leads').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      if (snap) pushUndo({ action: `Eliminar lead: ${input.nombre}`, table: 'akiter_crm_leads', entityId: input.id as string, operation: 'delete', prevValues: snap as Record<string, unknown> })
      return `Lead "${input.nombre}" eliminado.\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'eliminar_proveedor': {
      const { data: snap } = await supabase.from('akiter_proveedores').select('*').eq('id', input.id).single()
      const { error } = await supabase.from('akiter_proveedores').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      if (snap) pushUndo({ action: `Eliminar proveedor: ${input.nombre}`, table: 'akiter_proveedores', entityId: input.id as string, operation: 'delete', prevValues: snap as Record<string, unknown> })
      return `Proveedor "${input.nombre}" eliminado.\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'eliminar_producto_inventario': {
      const { data: snap } = await supabase.from('akiter_inventario').select('*').eq('id', input.id).single()
      const { error } = await supabase.from('akiter_inventario').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      if (snap) pushUndo({ action: `Eliminar producto: ${input.nombre}`, table: 'akiter_inventario', entityId: input.id as string, operation: 'delete', prevValues: snap as Record<string, unknown> })
      return `Producto "${input.nombre}" eliminado del inventario.\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    case 'eliminar_proyecto': {
      const { data: snap } = await supabase.from('akiter_proyectos').select('*').eq('id', input.id).single()
      const { error } = await supabase.from('akiter_proyectos').delete().eq('id', input.id)
      if (error) throw new Error(error.message)
      if (snap) pushUndo({ action: `Eliminar proyecto: ${input.nombre}`, table: 'akiter_proyectos', entityId: input.id as string, operation: 'delete', prevValues: snap as Record<string, unknown> })
      return `Proyecto "${input.nombre}" eliminado.\n\nPuedes decir "deshacer" si quieres revertir esta acción.`
    }

    // ── Deshacer ───────────────────────────────────────────────────────────

    case 'deshacer_ultima_accion': {
      const entry = _undo.shift()
      if (!entry) throw new Error('No hay acciones recientes que deshacer en esta sesión. El historial de deshacer se borra al recargar la página.')

      if (entry.operation === 'create') {
        const { error } = await supabase.from(entry.table).delete().eq('id', entry.entityId)
        if (error) throw new Error(`No se pudo deshacer: ${error.message}`)
        return `Deshecho: se eliminó el registro creado (${entry.action})`
      }

      if (entry.operation === 'update' || entry.operation === 'stock') {
        const { error } = await supabase.from(entry.table).update(entry.prevValues).eq('id', entry.entityId)
        if (error) throw new Error(`No se pudo deshacer: ${error.message}`)
        return `Deshecho: se restauraron los valores anteriores (${entry.action})`
      }

      if (entry.operation === 'delete') {
        const { error } = await supabase.from(entry.table).insert(entry.prevValues)
        if (error) throw new Error(`No se pudo restaurar el registro eliminado: ${error.message}`)
        return `Deshecho: registro restaurado (${entry.action})`
      }

      throw new Error('Tipo de operación desconocido en el historial de deshacer')
    }

    default:
      throw new Error(`Herramienta no reconocida: ${toolName}`)
  }
}

// ─── Data snapshot for system prompt ──────────────────────────────────────────

export interface DataSnapshot {
  clientes: unknown[]
  proyectos: unknown[]
  presupuestos: unknown[]
  facturas: unknown[]
  leads: unknown[]
  inventario: unknown[]
  cobros: unknown[]
  loadedAt: string
}

export async function loadDataSnapshot(): Promise<DataSnapshot> {
  const [c, p, pr, f, l, i, co] = await Promise.all([
    supabase.from('akiter_clientes').select('id,nombre,estado,localidad,email,telefono').order('nombre').limit(100),
    supabase.from('akiter_proyectos').select('id,nombre,estado,presupuesto,fecha_inicio,fecha_fin,localidad').order('created_at', { ascending: false }).limit(60),
    supabase.from('akiter_presupuestos').select('id,numero,estado,base_imponible,total,fecha_emision,iva_porcentaje').order('created_at', { ascending: false }).limit(50),
    supabase.from('akiter_facturas').select('id,numero,estado,base_imponible,total,fecha_emision,fecha_vencimiento').order('created_at', { ascending: false }).limit(50),
    supabase.from('akiter_crm_leads').select('id,nombre,empresa,etapa,valor,email,telefono').order('created_at', { ascending: false }).limit(60),
    supabase.from('akiter_inventario').select('id,nombre,referencia,stock,stock_minimo,precio_unitario,categoria').order('nombre').limit(100),
    supabase.from('akiter_cobros').select('id,importe,fecha_cobro,forma_pago').order('fecha_cobro', { ascending: false }).limit(30),
  ])

  return {
    clientes:     c.data  ?? [],
    proyectos:    p.data  ?? [],
    presupuestos: pr.data ?? [],
    facturas:     f.data  ?? [],
    leads:        l.data  ?? [],
    inventario:   i.data  ?? [],
    cobros:       co.data ?? [],
    loadedAt: new Date().toLocaleString('es-ES'),
  }
}

// ─── System prompt with injected ERP data ────────────────────────────────────

export function buildSystemPrompt(snap: DataSnapshot): string {
  const today = new Date().toLocaleDateString('es-ES', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  type FacturaRow    = { estado: string; total: number }
  type ProyectoRow   = { estado: string }
  type LeadRow       = { etapa: string }
  type InventarioRow = { stock: number; stock_minimo: number }

  const factPendientes   = (snap.facturas as FacturaRow[]).filter(f => f.estado === 'emitida')
  const totalPendiente   = factPendientes.reduce((s, f) => s + Number(f.total ?? 0), 0)
  const proyectosActivos = (snap.proyectos as ProyectoRow[]).filter(p => p.estado === 'en_curso').length
  const leadsAbiertos    = (snap.leads as LeadRow[]).filter(l => !['ganado','perdido'].includes(l.etapa)).length
  const stockBajo        = (snap.inventario as InventarioRow[]).filter(i => i.stock <= i.stock_minimo).length

  return `Eres el asistente interno de IA de AKITER ENERGÍAS RENOVABLES.

FECHA ACTUAL: ${today}
DATOS CARGADOS: ${snap.loadedAt}

CONTEXTO DE LA EMPRESA:
- Empresa española de instalaciones fotovoltaicas, climatización y energías renovables
- Clientes: particulares, empresas, administraciones públicas
- Operaciones en Andalucía principalmente
- Equipo técnico propio + red de subcontratistas

RESUMEN ACTUAL DEL NEGOCIO:
- Clientes activos: ${(snap.clientes as Array<{ estado: string }>).filter(c => c.estado === 'activo').length} de ${snap.clientes.length} totales
- Proyectos en curso: ${proyectosActivos}
- Leads abiertos: ${leadsAbiertos} de ${snap.leads.length} totales
- Facturas emitidas pendientes de cobro: ${factPendientes.length} (${totalPendiente.toLocaleString('es-ES')} €)
- Artículos con stock ≤ mínimo: ${stockBajo}

NOTA SOBRE ESTRUCTURA DE DATOS:
- Leads en "akiter_crm_leads": nombre, empresa, valor (no valor_estimado), etapas: nuevo|contactado|propuesta|negociacion|ganado|perdido
- Inventario: columna "stock" (no "stock_actual"), "precio_unitario" (no "precio_venta"), SIN columna "descripcion"
- Clientes: SIN campo "tipo". Tienen "direccion" además de "localidad"
- Proyectos: "presupuesto" (no "presupuesto_total"), "fecha_fin" (no "fecha_fin_prevista"), "codigo" es UNIQUE y NO se puede cambiar
- Proveedores: tienen "localidad" (no "direccion" ni "ciudad")

CAPACIDAD DE DESHACER (UNDO):
- Tienes memoria de sesión de las últimas 10 acciones de escritura
- Si el usuario dice "deshacer", "no era eso", "deshaz eso", "cambialo", "error", "perdona", "equivocado" o similares → usa la herramienta deshacer_ultima_accion
- Puedes deshacer: creaciones (borra el registro), actualizaciones (restaura valores anteriores), eliminaciones (restaura el registro), cambios de stock
- El historial de deshacer se borra al recargar la página

CAPACIDADES DE VISIÓN (análisis de imágenes):
- Puedes leer albaranes, facturas, contratos, partes de entrega y notas de pedido
- Identifica: proveedor, cliente, fecha, número de documento, líneas de producto (referencia, descripción, cantidad, precio), totales e IVA
- ALBARANES: para cada línea, comprueba si el producto existe en inventario. Si existe → registrar_movimiento_inventario (entrada). Si no existe → crear_producto_inventario primero
- Tras analizar, ofrece SIEMPRE crear/actualizar los registros con confirmación del usuario

DATOS COMPLETOS DEL ERP:

=== CLIENTES (${snap.clientes.length}) ===
${JSON.stringify(snap.clientes)}

=== PROYECTOS (${snap.proyectos.length}) ===
${JSON.stringify(snap.proyectos)}

=== PRESUPUESTOS (${snap.presupuestos.length} recientes) ===
${JSON.stringify(snap.presupuestos)}

=== FACTURAS (${snap.facturas.length} recientes) ===
${JSON.stringify(snap.facturas)}

=== LEADS/OPORTUNIDADES CRM (${snap.leads.length}) ===
${JSON.stringify(snap.leads)}

=== INVENTARIO (${snap.inventario.length} artículos) ===
${JSON.stringify(snap.inventario)}

=== COBROS (${snap.cobros.length} recientes) ===
${JSON.stringify(snap.cobros)}

INSTRUCCIONES:
- Responde SIEMPRE en español, profesional y conciso
- Para importes: formato español 1.234,56 €
- Al crear o modificar datos, usa las herramientas disponibles y describe exactamente qué harás antes de ejecutar
- Tras cada acción de escritura exitosa, recuerda brevemente que el usuario puede decir "deshacer" para revertirla
- Proporciona insights accionables al analizar datos
- Si un dato no está en el contexto, dilo claramente
- Menciona alertas proactivamente: facturas vencidas, stock bajo, leads parados`
}
