export type UserRole = 'direccion' | 'comercial' | 'tecnico' | 'administrativo' | 'subcontratista'

export interface User {
  id: string
  email: string
  nombre: string
  apellidos: string
  rol: UserRole
  avatar_url?: string
  activo: boolean
  created_at: string
}

export interface AuthState {
  user: User | null
  session: unknown | null
  loading: boolean
}

// Permissions map per role
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  direccion: ['*'],
  comercial: ['crm', 'presupuestos', 'clientes', 'subvenciones'],
  tecnico: ['proyectos', 'partes_trabajo', 'inventario_read'],
  administrativo: ['facturacion', 'cobros', 'proveedores'],
  subcontratista: ['mis_ordenes', 'mis_partes'],
}

export const ROLE_LABELS: Record<UserRole, string> = {
  direccion: 'Dirección',
  comercial: 'Comercial',
  tecnico: 'Técnico',
  administrativo: 'Administrativo',
  subcontratista: 'Subcontratista',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  direccion: 'bg-purple-100 text-purple-800',
  comercial: 'bg-blue-100 text-blue-800',
  tecnico: 'bg-orange-100 text-orange-800',
  administrativo: 'bg-green-100 text-green-800',
  subcontratista: 'bg-gray-100 text-gray-800',
}
