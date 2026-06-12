import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User, UserRole } from '../types'

interface AuthStore {
  user: User | null
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  hasPermission: (permission: string) => boolean
  initialize: () => Promise<void>
}

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  direccion: ['*'],
  comercial: ['crm', 'presupuestos', 'clientes', 'subvenciones'],
  tecnico: ['proyectos', 'partes_trabajo', 'inventario_read'],
  administrativo: ['facturacion', 'cobros', 'proveedores'],
  subcontratista: ['mis_ordenes', 'mis_partes'],
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      loading: true,

      setUser: (user) => set({ user }),
      setLoading: (loading) => set({ loading }),

      signIn: async (email, password) => {
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) return { error: error.message }

          if (data.user) {
            const { data: profile, error: profileError } = await supabase
              .from('akiter_usuarios')
              .select('*')
              .eq('id', data.user.id)
              .single()

            if (profileError) return { error: 'No se pudo cargar el perfil de usuario.' }
            set({ user: profile as User })
          }
          return { error: null }
        } catch {
          return { error: 'Error de conexión. Intente de nuevo.' }
        }
      },

      signOut: async () => {
        await supabase.auth.signOut()
        set({ user: null })
      },

      hasPermission: (permission) => {
        const { user } = get()
        if (!user) return false
        const perms = ROLE_PERMISSIONS[user.rol]
        return perms.includes('*') || perms.includes(permission)
      },

      initialize: async () => {
        set({ loading: true })
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            const { data: profile } = await supabase
              .from('akiter_usuarios')
              .select('*')
              .eq('id', session.user.id)
              .single()
            set({ user: profile as User })
          } else {
            set({ user: null })
          }
        } finally {
          set({ loading: false })
        }
      },
    }),
    {
      name: 'akiter-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
)
