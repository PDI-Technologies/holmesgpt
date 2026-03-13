import { useState, useEffect, useCallback } from 'react'
import { api, Investigation } from '../lib/api'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function sourceBadgeClass(source: string): string {
  const map: Record<string, string> = {
    ui: 'bg-pdi-sky/10 text-pdi-indigo',
    cli: 'bg-gray-100 text-gray-600',
    pagerduty: 'bg-green-50 text-green-700',
    ado: 'bg-blue-50 text-blue-700',
    salesforce: 'bg-sky-50 text-sky-700',
    webhook: 'bg-purple-50 text-purple-700',
  }
  return map[source.toLowerCase()] ?? 'bg-gray-100 text-gray-600'
}

function statusBadge(status: string) {
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        Completed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
      Running
    </span>
  )
}

// ── Tool call trace panel ─────────────────────────────────────────────────────

function ToolCallTrace({ calls }: { calls: Investigation['tool_calls'] }) {
  const [expanded, setExpanded] = useState<number | null>(null)

  if (calls.length === 0) {
    return <p className="text-sm text-gray-400 italic">No tool calls recorded.</p>
  }

  return (
    <div className="space-y-1.5">
      {calls.map((tc, i) => (
        <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            type="button"
            onClick={() => setExpanded(expanded === i ? null : i)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <svg className="w-3.5 h-3.5 text-pdi-sky shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <code className="text-xs font-mono text-gray-800 truncate">{tc.tool_name}</code>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {tc.called_at && (
                <span className="text-xs text-gray-400">{formatDate(tc.called_at)}</span>
              )}
              <svg
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded === i ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {expanded === i && (
            <div className="px-3 py-2 bg-white border-t border-gray-100">
              {tc.tool_output ? (
                <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words font-mono max-h-64 overflow-y-auto">
                  {tc.tool_output}
                </pre>
              ) : (
                <p className="text-xs text-gray-400 italic">No output captured.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function InvestigationDetail({
  investigation,
  loading,
  onClose,
}: {
  investigation: Investigation
  loading?: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* Drawer */}
      <div className="w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {statusBadge(investigation.status)}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceBadgeClass(investigation.source)}`}>
                {investigation.source}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{investigation.question || '(no question)'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(investigation.started_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Answer */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Answer</h3>
            {investigation.answer ? (
              <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {investigation.answer}
              </div>
            ) : investigation.status === 'failed' ? (
              <p className="text-sm text-red-600">{investigation.error || 'Investigation failed.'}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">No answer recorded.</p>
            )}
          </div>

          {/* Source link */}
          {investigation.source_url && (
            <div>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Source</h3>
              <a
                href={investigation.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-pdi-sky hover:underline break-all"
              >
                {investigation.source_id || investigation.source_url}
              </a>
            </div>
          )}

          {/* Tool call trace */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Tool Calls ({investigation.tool_calls.length})
            </h3>
            {loading ? (
              <div className="space-y-1.5">
                {[...Array(Math.min(investigation.tool_calls.length || 3, 5))].map((_, i) => (
                  <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : (
              <ToolCallTrace calls={investigation.tool_calls} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

const SOURCE_OPTIONS = ['', 'ui', 'cli', 'pagerduty', 'ado', 'salesforce', 'webhook']

export default function InvestigationHistory() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState('')
  const [selected, setSelected] = useState<Investigation | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getInvestigations({
        limit: 100,
        source: sourceFilter || undefined,
      })
      setInvestigations(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load investigations')
    } finally {
      setLoading(false)
    }
  }, [sourceFilter])

  useEffect(() => {
    load()
  }, [load])

  const handleSelect = async (inv: Investigation) => {
    // Show the row data immediately (no tool_output yet), then fetch full detail
    setSelected(inv)
    setLoadingDetail(true)
    try {
      const full = await api.getInvestigation(inv.id)
      setSelected(full)
    } catch {
      // Keep showing the partial data if the detail fetch fails
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this investigation record? This cannot be undone.')) return
    setDeleting(id)
    try {
      await api.deleteInvestigation(id)
      setInvestigations((prev) => prev.filter((i) => i.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Investigation History</h1>
            <p className="text-sm text-gray-500 mt-1">
              Every investigation Holmes has run — click a row to see the full tool call trace.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <label className="text-sm text-gray-600 font-medium shrink-0">Source:</label>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-pdi-sky"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s || 'All sources'}
              </option>
            ))}
          </select>
          {investigations.length > 0 && (
            <span className="text-sm text-gray-400 ml-auto">
              {investigations.length} record{investigations.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-gray-200 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && investigations.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm">No investigations yet. Start a chat to create one.</p>
          </div>
        )}

        {/* Table */}
        {!loading && investigations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-36">When</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Question</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Tools</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {investigations.map((inv) => (
                  <tr
                    key={inv.id}
                    onClick={() => handleSelect(inv)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(inv.started_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs">
                      <p className="truncate">{inv.question || <span className="text-gray-400 italic">—</span>}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sourceBadgeClass(inv.source)}`}>
                        {inv.source}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {statusBadge(inv.status)}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 text-center">
                      {inv.tool_calls.length}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={(e) => handleDelete(inv.id, e)}
                        disabled={deleting === inv.id}
                        className="p-1 text-gray-300 hover:text-red-500 transition-colors rounded disabled:opacity-40"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selected && (
        <InvestigationDetail
          investigation={selected}
          loading={loadingDetail}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
