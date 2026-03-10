import { useState, useEffect } from 'react'
import { api } from '../lib/api'

interface StatusCheck {
  label: string
  status: 'ok' | 'error' | 'loading'
  detail?: string
}

export default function Settings() {
  const [model, setModel] = useState<string>('')
  const [checks, setChecks] = useState<StatusCheck[]>([
    { label: 'Health', status: 'loading' },
    { label: 'Readiness', status: 'loading' },
  ])

  useEffect(() => {
    api.getModel().then((data) => {
      setModel(data.model_name)
    }).catch(() => {
      setModel('Unknown')
    })

    api.getHealth().then((data) => {
      setChecks((prev) =>
        prev.map((c) =>
          c.label === 'Health'
            ? { ...c, status: data.status === 'healthy' ? 'ok' : 'error', detail: data.status }
            : c,
        ),
      )
    }).catch((err) => {
      setChecks((prev) =>
        prev.map((c) =>
          c.label === 'Health' ? { ...c, status: 'error', detail: String(err) } : c,
        ),
      )
    })

    api.getReadiness().then((data) => {
      setChecks((prev) =>
        prev.map((c) =>
          c.label === 'Readiness'
            ? { ...c, status: data.status === 'ready' ? 'ok' : 'error', detail: data.status }
            : c,
        ),
      )
    }).catch((err) => {
      setChecks((prev) =>
        prev.map((c) =>
          c.label === 'Readiness' ? { ...c, status: 'error', detail: String(err) } : c,
        ),
      )
    })
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <h2 className="text-lg font-bold text-pdi-granite">Settings</h2>
        <p className="text-xs text-pdi-slate">System status and configuration</p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-xl space-y-6">
          {/* Model info */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-pdi-granite mb-3">Model</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-pdi-indigo/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-pdi-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-pdi-granite">
                  {model || 'Loading...'}
                </p>
                <p className="text-xs text-pdi-slate">Active LLM model</p>
              </div>
            </div>
          </div>

          {/* Health checks */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-pdi-granite mb-3">System Status</h3>
            <div className="space-y-3">
              {checks.map((check) => (
                <div key={check.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {check.status === 'loading' && (
                      <span className="w-2.5 h-2.5 bg-pdi-sun rounded-full animate-pulse" />
                    )}
                    {check.status === 'ok' && (
                      <span className="w-2.5 h-2.5 bg-pdi-grass rounded-full" />
                    )}
                    {check.status === 'error' && (
                      <span className="w-2.5 h-2.5 bg-pdi-orange rounded-full" />
                    )}
                    <span className="text-sm text-pdi-granite">{check.label}</span>
                  </div>
                  <span className="text-xs text-pdi-slate font-mono">
                    {check.detail || (check.status === 'loading' ? 'Checking...' : '')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* About */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-pdi-granite mb-3">About</h3>
            <div className="space-y-2 text-sm text-pdi-slate">
              <p>
                <span className="font-medium text-pdi-granite">HolmesGPT</span> is an AI-powered
                troubleshooting agent that connects to observability platforms to automatically
                diagnose and analyze infrastructure issues.
              </p>
              <p>
                Built by <span className="font-medium text-pdi-granite">PDI Technologies</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
