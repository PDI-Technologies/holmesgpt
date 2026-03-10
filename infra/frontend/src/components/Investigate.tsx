import { useState } from 'react'
import { useInvestigate } from '../hooks/useInvestigate'
import MessageBubble from './MessageBubble'
import ToolCallCard from './ToolCallCard'

const SOURCES = ['Manual', 'AlertManager', 'PagerDuty', 'Jira', 'OpsGenie', 'Salesforce', 'Azure DevOps']

export default function Investigate() {
  const { investigations, loading, investigate, clearInvestigations } = useInvestigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [source, setSource] = useState('Manual')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !description.trim() || loading) return
    investigate(title.trim(), description.trim(), source)
    setTitle('')
    setDescription('')
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-bold text-pdi-granite">Investigations</h2>
          <p className="text-xs text-pdi-slate">Submit alerts for AI-powered root cause analysis</p>
        </div>
        {investigations.length > 0 && (
          <button
            onClick={clearInvestigations}
            className="text-xs text-pdi-slate hover:text-pdi-granite px-3 py-1.5 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors"
          >
            Clear history
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Form */}
        <div className="px-6 py-5 border-b border-gray-200 bg-white">
          <form onSubmit={handleSubmit} className="space-y-3 max-w-2xl">
            <div className="flex gap-3">
              <div className="flex-1">
                <label htmlFor="inv-title" className="block text-xs font-medium text-pdi-granite mb-1">
                  Alert Title
                </label>
                <input
                  id="inv-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., High CPU usage on payment-service"
                  className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent"
                  required
                />
              </div>
              <div className="w-40">
                <label htmlFor="inv-source" className="block text-xs font-medium text-pdi-granite mb-1">
                  Source
                </label>
                <select
                  id="inv-source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent bg-white"
                >
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="inv-desc" className="block text-xs font-medium text-pdi-granite mb-1">
                Description
              </label>
              <textarea
                id="inv-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the alert or issue in detail..."
                rows={3}
                className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent resize-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !title.trim() || !description.trim()}
              className="px-5 py-2 bg-pdi-sky text-white rounded-lg font-medium text-sm hover:bg-pdi-sky/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Investigating...' : 'Investigate'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="px-6 py-4 space-y-4">
          {investigations.map((inv) => (
            <div key={inv.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Investigation header */}
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm text-pdi-granite">{inv.title}</h3>
                  <p className="text-xs text-pdi-slate mt-0.5">
                    {inv.source} &middot; {inv.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                <div>
                  {inv.loading && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-pdi-sky font-medium">
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-pulse" />
                      Analyzing
                    </span>
                  )}
                  {inv.result && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-pdi-grass font-medium">
                      <span className="w-2 h-2 bg-pdi-grass rounded-full" />
                      Complete
                    </span>
                  )}
                  {inv.error && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-pdi-orange font-medium">
                      <span className="w-2 h-2 bg-pdi-orange rounded-full" />
                      Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Investigation body */}
              <div className="px-5 py-4">
                {inv.loading && (
                  <div className="flex items-center gap-2 text-pdi-slate text-sm py-4">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    Holmes is investigating this issue...
                  </div>
                )}

                {inv.error && (
                  <div className="bg-pdi-orange/10 text-pdi-orange text-sm px-4 py-3 rounded-lg">
                    {inv.error}
                  </div>
                )}

                {inv.result && (
                  <>
                    <MessageBubble role="assistant" content={inv.result.analysis} />
                    {inv.result.tool_calls && inv.result.tool_calls.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs font-medium text-pdi-slate mb-2">
                          Tools used ({inv.result.tool_calls.length})
                        </p>
                        {inv.result.tool_calls.map((tc, i) => (
                          <ToolCallCard
                            key={i}
                            toolName={tc.tool_name}
                            description={tc.description}
                            result={tc.result}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}

          {investigations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-pdi-sky/10 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-pdi-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-pdi-granite font-semibold text-lg mb-1">No investigations yet</h3>
              <p className="text-pdi-slate text-sm max-w-md">
                Submit an alert above and Holmes will perform a root cause analysis using available toolsets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
