import { useState, useEffect, useRef, useCallback } from 'react'
import { api, type SimilarInvestigation } from '../lib/api'

interface SimilarInvestigationsPanelProps {
  query: string
  projectId?: string
}

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100)
  const color =
    pct >= 80
      ? 'bg-emerald-100 text-emerald-700'
      : pct >= 50
        ? 'bg-amber-100 text-amber-700'
        : 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {pct}% match
    </span>
  )
}

function FeedbackBadge({ feedback }: { feedback: string | null }) {
  if (feedback === 'helpful') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
        Verified
      </span>
    )
  }
  return null
}

export default function SimilarInvestigationsPanel({
  query,
  projectId,
}: SimilarInvestigationsPanelProps) {
  const [results, setResults] = useState<SimilarInvestigation[]>([])
  const [loading, setLoading] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSimilar = useCallback(
    async (q: string) => {
      if (!q || q.trim().length < 10) {
        setResults([])
        return
      }
      setLoading(true)
      try {
        const data = await api.getSimilarInvestigations(q, projectId, 5)
        setResults(data)
        // Auto-expand panel if we found results
        if (data.length > 0) setCollapsed(false)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => fetchSimilar(query), 800)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSimilar])

  // Don't render anything if no query and no results
  if (!query && results.length === 0) return null

  return (
    <div
      className={`border-l border-pdi-cool-gray bg-gray-50/50 flex flex-col transition-all duration-200 ${
        collapsed ? 'w-10' : 'w-80'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-pdi-cool-gray bg-white">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-pdi-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-pdi-granite">Past Investigations</span>
            {results.length > 0 && (
              <span className="text-xs bg-pdi-sky/10 text-pdi-sky px-1.5 py-0.5 rounded-full font-medium">
                {results.length}
              </span>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100 text-pdi-slate"
          title={collapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <svg className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Collapsed state — just show count badge */}
      {collapsed && results.length > 0 && (
        <div className="flex flex-col items-center py-4">
          <span className="text-xs font-bold text-pdi-sky bg-pdi-sky/10 w-6 h-6 rounded-full flex items-center justify-center">
            {results.length}
          </span>
        </div>
      )}

      {/* Expanded content */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-pdi-slate py-4">
              <div className="w-3 h-3 border-2 border-pdi-sky/30 border-t-pdi-sky rounded-full animate-spin" />
              Searching past investigations...
            </div>
          )}

          {!loading && results.length === 0 && query.trim().length >= 10 && (
            <p className="text-xs text-pdi-slate py-4 text-center">
              No similar past investigations found.
            </p>
          )}

          {!loading && results.length === 0 && query.trim().length < 10 && (
            <p className="text-xs text-pdi-slate py-4 text-center">
              Type a question to see similar past investigations.
            </p>
          )}

          {results.map((inv) => (
            <div
              key={inv.id}
              className="bg-white rounded-lg border border-pdi-cool-gray p-3 hover:border-pdi-sky/50 transition-colors cursor-pointer"
              onClick={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
            >
              {/* Header row */}
              <div className="flex items-center gap-2 mb-1.5">
                <ScoreBadge score={inv.score} />
                <FeedbackBadge feedback={inv.feedback} />
              </div>

              {/* Question */}
              <p className="text-sm font-medium text-pdi-granite leading-snug mb-1">
                {inv.question.length > 80 ? inv.question.slice(0, 77) + '...' : inv.question}
              </p>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-pdi-slate">
                <span className="capitalize">{inv.source}</span>
                <span>-</span>
                <span>{timeAgo(inv.started_at)}</span>
                {inv.tools_used.length > 0 && (
                  <>
                    <span>-</span>
                    <span>{inv.tools_used.length} tools</span>
                  </>
                )}
              </div>

              {/* Expanded: resolution summary */}
              {expandedId === inv.id && (
                <div className="mt-2 pt-2 border-t border-pdi-cool-gray">
                  <p className="text-xs font-medium text-pdi-granite mb-1">
                    {inv.feedback === 'helpful' ? 'Verified Resolution:' : 'Analysis Summary:'}
                  </p>
                  <p className="text-xs text-pdi-slate leading-relaxed whitespace-pre-wrap">
                    {inv.answer_summary}
                  </p>
                  {inv.tools_used.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {inv.tools_used.map((t) => (
                        <span key={t} className="text-[10px] bg-gray-100 text-pdi-slate px-1.5 py-0.5 rounded font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
