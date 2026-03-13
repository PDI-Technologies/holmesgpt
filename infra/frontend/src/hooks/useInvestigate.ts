import { useState, useCallback } from 'react'
import { api, type InvestigateResponse } from '../lib/api'

interface Investigation {
  id: string
  title: string
  source: string
  description: string
  result: InvestigateResponse | null
  error: string | null
  loading: boolean
  timestamp: Date
}

export function useInvestigate(projectId?: string | null) {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(false)

  const investigate = useCallback(
    async (title: string, description: string, source: string, context: Record<string, string> = {}) => {
      const inv: Investigation = {
        id: crypto.randomUUID(),
        title,
        source,
        description,
        result: null,
        error: null,
        loading: true,
        timestamp: new Date(),
      }

      setInvestigations((prev) => [inv, ...prev])
      setLoading(true)

      try {
        const result = await api.investigateStream({
          source,
          title,
          description,
          subject: { name: title },
          context,
          include_tool_calls: true,
          include_tool_call_results: true,
          project_id: projectId ?? null,
        })

        setInvestigations((prev) =>
          prev.map((i) =>
            i.id === inv.id ? { ...i, result, loading: false } : i,
          ),
        )
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Investigation failed'
        setInvestigations((prev) =>
          prev.map((i) =>
            i.id === inv.id ? { ...i, error: errorMessage, loading: false } : i,
          ),
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const clearInvestigations = useCallback(() => {
    setInvestigations([])
  }, [])

  return { investigations, loading, investigate, clearInvestigations }
}
