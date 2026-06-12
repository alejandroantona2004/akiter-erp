import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '../types'

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('akiter_usuarios').select('*').eq('activo', true).order('nombre')
      .then(({ data }) => { setUsuarios((data ?? []) as User[]); setLoading(false) })
  }, [])

  return { usuarios, loading }
}
