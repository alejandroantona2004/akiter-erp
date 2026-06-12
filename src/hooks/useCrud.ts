import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

interface UseCrudOptions {
  select?: string
  orderBy?: string
  orderAsc?: boolean
  eq?: [string, unknown][]
}

export function useCrud<T extends { id: string }>(table: string, options: UseCrudOptions = {}) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const eqKey = JSON.stringify(options.eq ?? [])

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q: any = supabase.from(table).select(options.select || '*')
      if (options.orderBy) q = q.order(options.orderBy, { ascending: options.orderAsc ?? false })
      if (options.eq) options.eq.forEach(([col, val]) => { q = q.eq(col, val) })
      const { data: rows, error: err } = await q
      if (err) throw err
      setData((rows ?? []) as T[])
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, options.select, options.orderBy, options.orderAsc, eqKey])

  useEffect(() => { fetch() }, [fetch])

  const create = async (values: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error: err } = await (supabase.from(table).insert(values as any).select(options.select || '*').single() as any)
    if (err) throw new Error(err.message)
    const created = row as T
    setData(prev => [created, ...prev])
    return created
  }

  const update = async (id: string, values: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: row, error: err } = await (supabase.from(table).update(values as any).eq('id', id).select(options.select || '*').single() as any)
    if (err) throw new Error(err.message)
    const updated = row as T
    setData(prev => prev.map(item => item.id === id ? updated : item))
    return updated
  }

  const remove = async (id: string): Promise<void> => {
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) throw new Error(err.message)
    setData(prev => prev.filter(item => item.id !== id))
  }

  return { data, loading, error, refetch: fetch, create, update, remove }
}
