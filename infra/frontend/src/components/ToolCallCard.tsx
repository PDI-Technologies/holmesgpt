import { useState } from 'react'

interface ToolCallCardProps {
  toolName: string
  description?: string
  result: string
}

export default function ToolCallCard({ toolName, description, result }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-pdi-cool-gray rounded-lg overflow-hidden my-2">
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
      </button>

      {expanded && (
        <div className="px-3 py-2 bg-pdi-granite text-gray-100 text-xs font-mono overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
          {result}
        </div>
      )}
    </div>
  )
}
