import { useState } from 'react'

interface ToolCallCardProps {
  toolName: string
  description?: string
  result: string
}

export default function ToolCallCard({ toolName, description, result }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="border border-pdi-cool-gray border-l-2 border-l-pdi-sky/40 rounded-lg overflow-hidden my-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-pdi-indigo/5 hover:bg-pdi-indigo/10 transition-colors text-left"
      >
        <svg
          className={`w-4 h-4 text-pdi-slate transition-transform ${expanded ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <svg className="w-4 h-4 text-pdi-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.384-3.19A.6.6 0 015.75 11.5V6.5a.6.6 0 01.286-.48l5.384-3.19a.6.6 0 01.6 0l5.384 3.19a.6.6 0 01.286.48v5a.6.6 0 01-.286.48l-5.384 3.19a.6.6 0 01-.6 0z" />
        </svg>
        <span className="text-xs font-mono font-medium text-pdi-granite">{toolName}</span>
        {description && (
          <span className="text-xs text-pdi-slate truncate ml-1">{description}</span>
        )}
        <button
          onClick={handleCopy}
          className="ml-auto p-1 text-pdi-slate hover:text-pdi-sky transition-colors rounded"
          aria-label="Copy tool result"
        >
          {copied ? (
            <svg
              className="w-4 h-4 text-pdi-grass"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
        </button>
      </button>

      {expanded && (
        <div className="px-3 py-2 bg-pdi-granite text-pdi-sky/90 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap border-t border-white/10">
          {result}
        </div>
      )}
    </div>
  )
}
