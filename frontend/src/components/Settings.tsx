import { useState, useEffect, useCallback } from 'react'
import { api, type AwsAccount, type LlmInstructionsEntry, type WebhookInfo } from '../lib/api'

interface StatusCheck {
  label: string
  status: 'ok' | 'error' | 'loading'
  detail?: string
}

// ── LLM Instructions sub-components ──────────────────────────────────────────

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  )
}

function DefaultToolsetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  )
}

interface IntegrationRowProps {
  entry: LlmInstructionsEntry
  isSelected: boolean
  onClick: () => void
}

function IntegrationRow({ entry, isSelected, onClick }: IntegrationRowProps) {
  const typeColor =
    entry.type === 'mcp'
      ? 'bg-pdi-ocean/10 text-pdi-ocean'
      : 'bg-gray-100 text-pdi-slate'

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
        isSelected
          ? 'bg-pdi-sky/10 border border-pdi-sky/30'
          : 'hover:bg-gray-50 border border-transparent'
      }`}
    >
      {/* Icon */}
      <div className="shrink-0 w-7 h-7 rounded-md bg-pdi-indigo/8 flex items-center justify-center overflow-hidden">
        {entry.icon_url ? (
          <img
            src={entry.icon_url}
            alt=""
            className="w-5 h-5 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <DefaultToolsetIcon className="w-3.5 h-3.5 text-pdi-indigo" />
        )}
      </div>

      {/* Name + badges */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${isSelected ? 'text-pdi-sky' : 'text-pdi-granite'}`}>
          {entry.name}
        </p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={`text-[9px] font-medium px-1 py-0.5 rounded ${typeColor}`}>
            {entry.type.toUpperCase()}
          </span>
          {entry.is_overridden && (
            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-pdi-sun/15 text-pdi-sun">
              CUSTOM
            </span>
          )}
        </div>
      </div>

      {/* Enabled dot */}
      <span
        className={`shrink-0 w-1.5 h-1.5 rounded-full ${entry.enabled ? 'bg-pdi-grass' : 'bg-gray-300'}`}
        title={entry.enabled ? 'Enabled' : 'Disabled'}
      />
    </button>
  )
}

interface EditorPanelProps {
  entry: LlmInstructionsEntry
  onSave: (name: string, instructions: string) => Promise<void>
  onReset: (name: string) => Promise<void>
}

function EditorPanel({ entry, onSave, onReset }: EditorPanelProps) {
  const [draft, setDraft] = useState(entry.instructions)
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const isDirty = draft !== entry.instructions

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await onSave(entry.name, draft)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2500)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleResetConfirmed = async () => {
    setConfirmReset(false)
    setResetting(true)
    setSaveError(null)
    try {
      await onReset(entry.name)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to reset')
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-pdi-granite truncate max-w-[220px]" title={entry.name}>
            {entry.name}
          </span>
          {entry.is_overridden && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-pdi-sun/15 text-pdi-sun uppercase tracking-wide">
              Custom
            </span>
          )}
        </div>
        {isDirty && (
          <span className="text-[10px] text-pdi-slate italic">Unsaved changes</span>
        )}
      </div>

      {/* Description */}
      {entry.description && (
        <p className="text-[11px] text-pdi-slate mb-2 line-clamp-2">{entry.description}</p>
      )}

      {/* Textarea */}
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={
          entry.has_default
            ? 'Loading instructions...'
            : 'No default instructions. Enter custom instructions for this integration...'
        }
        className="flex-1 w-full min-h-[200px] px-3 py-2.5 border border-pdi-cool-gray rounded-lg text-xs font-mono text-pdi-granite resize-none focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent leading-relaxed"
        spellCheck={false}
      />

      {/* Error */}
      {saveError && (
        <div className="mt-2 text-xs text-pdi-orange bg-pdi-orange/5 border border-pdi-orange/20 rounded-lg px-3 py-2">
          {saveError}
        </div>
      )}

      {/* Session note */}
      <p className="mt-2 text-[10px] text-pdi-slate/80 italic">
        Changes apply immediately but are lost on pod restart.
      </p>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-pdi-cool-gray">
        {confirmReset ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-pdi-slate">Reset to default?</span>
            <button
              onClick={handleResetConfirmed}
              className="px-2 py-1 text-xs font-medium text-white bg-pdi-orange rounded hover:bg-pdi-orange/90 transition-colors"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="px-2 py-1 text-xs font-medium text-pdi-slate bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            >
              No
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            disabled={resetting || !entry.is_overridden}
            title={entry.is_overridden ? 'Remove override and restore default' : 'No override to reset'}
            className="text-xs text-pdi-slate hover:text-pdi-orange disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {resetting ? (
              <>
                <span className="w-3 h-3 border border-pdi-slate border-t-transparent rounded-full animate-spin" />
                Resetting...
              </>
            ) : (
              'Reset to default'
            )}
          </button>
        )}

        <div className="flex items-center gap-2">
          {saveSuccess && (
            <span className="text-xs text-pdi-grass font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Saved
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="px-3 py-1.5 text-xs text-white bg-pdi-sky rounded-lg font-medium hover:bg-pdi-sky/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Save & Apply
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Settings component ───────────────────────────────────────────────────

export default function Settings() {
  const [model, setModel] = useState<string>('')
  const [checks, setChecks] = useState<StatusCheck[]>([
    { label: 'Health', status: 'loading' },
    { label: 'Readiness', status: 'loading' },
  ])
  const [awsAccounts, setAwsAccounts] = useState<AwsAccount[]>([])
  const [irsaRole, setIrsaRole] = useState('')
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([])
  const [webhookDevMode, setWebhookDevMode] = useState(false)
  const [devModeUpdating, setDevModeUpdating] = useState(false)

  // System prompt additions state
  const [systemPrompt, setSystemPrompt] = useState('')
  const [systemPromptDraft, setSystemPromptDraft] = useState('')
  const [systemPromptSaving, setSystemPromptSaving] = useState(false)
  const [systemPromptSuccess, setSystemPromptSuccess] = useState(false)
  const [systemPromptError, setSystemPromptError] = useState<string | null>(null)

  // LLM Instructions state
  const [llmIntegrations, setLlmIntegrations] = useState<LlmInstructionsEntry[]>([])
  const [llmLoading, setLlmLoading] = useState(true)
  const [llmError, setLlmError] = useState<string | null>(null)
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(null)

  const loadLlmInstructions = useCallback(async () => {
    setLlmLoading(true)
    setLlmError(null)
    try {
      const data = await api.getLlmInstructions()
      setLlmIntegrations(data.integrations)
      setSelectedIntegration((prev) =>
        prev ? prev : (data.integrations[0]?.name ?? null),
      )
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : 'Failed to load instructions')
    } finally {
      setLlmLoading(false)
    }
  }, [])

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

    api.getAppSettings().then((data) => {
      setSystemPrompt(data.system_prompt_additions || '')
      setSystemPromptDraft(data.system_prompt_additions || '')
    }).catch(() => {})

    api.getAwsAccounts().then((data) => {
      setAwsAccounts(data.accounts)
      setIrsaRole(data.irsa_role)
    }).catch(() => {})

    api.getWebhooks().then((data) => {
      setWebhooks(data.webhooks)
      setWebhookDevMode(data.webhook_dev_mode ?? false)
    }).catch(() => {})

    loadLlmInstructions()
  }, [loadLlmInstructions])

  const handleSaveInstructions = async (name: string, instructions: string) => {
    const updated = await api.updateLlmInstructions(name, instructions)
    setLlmIntegrations((prev) =>
      prev.map((e) =>
        e.name === name
          ? { ...e, instructions: updated.instructions, is_overridden: updated.is_overridden }
          : e,
      ),
    )
  }

  const handleResetInstructions = async (name: string) => {
    const updated = await api.resetLlmInstructions(name)
    setLlmIntegrations((prev) =>
      prev.map((e) =>
        e.name === name
          ? { ...e, instructions: updated.instructions, is_overridden: updated.is_overridden }
          : e,
      ),
    )
  }

  const handleSaveSystemPrompt = async () => {
    setSystemPromptSaving(true)
    setSystemPromptError(null)
    setSystemPromptSuccess(false)
    try {
      const result = await api.updateAppSettings({ system_prompt_additions: systemPromptDraft })
      setSystemPrompt(result.system_prompt_additions || '')
      setSystemPromptSuccess(true)
      setTimeout(() => setSystemPromptSuccess(false), 2500)
    } catch (err) {
      setSystemPromptError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSystemPromptSaving(false)
    }
  }

  const systemPromptDirty = systemPromptDraft !== systemPrompt

  const selectedEntry = llmIntegrations.find((e) => e.name === selectedIntegration) ?? null
  const customCount = llmIntegrations.filter((e) => e.is_overridden).length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="relative px-6 py-4 border-b border-pdi-cool-gray bg-white">
        <h2 className="text-lg font-bold text-pdi-granite">Settings</h2>
        <p className="text-xs text-pdi-slate">System status and configuration</p>
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pdi-sky via-pdi-ocean to-pdi-indigo opacity-60" />
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-4xl space-y-6">
          {/* Model info */}
          <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
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
          <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
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

          {/* AWS Accounts */}
          {awsAccounts.length > 0 && (
            <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 flex items-center justify-center">
                  <svg className="w-5 h-5 text-pdi-sun" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6.763 10.036c0 .296.032.535.088.71.064.176.144.368.256.576.04.064.056.128.056.184 0 .08-.048.16-.152.24l-.504.336a.383.383 0 01-.208.072c-.08 0-.16-.04-.24-.112a2.47 2.47 0 01-.288-.376 6.18 6.18 0 01-.248-.472c-.624.736-1.408 1.104-2.352 1.104-.672 0-1.208-.192-1.6-.576-.392-.384-.592-.896-.592-1.536 0-.68.24-1.232.728-1.648.488-.416 1.136-.624 1.96-.624.272 0 .552.024.848.064.296.04.6.104.92.176v-.584c0-.608-.128-1.032-.376-1.28-.256-.248-.688-.368-1.304-.368-.28 0-.568.032-.864.104-.296.072-.584.16-.864.272a2.294 2.294 0 01-.28.104.488.488 0 01-.128.024c-.112 0-.168-.08-.168-.248v-.392c0-.128.016-.224.056-.28a.597.597 0 01.224-.168c.28-.144.616-.264 1.008-.36A4.84 4.84 0 014.8 6.4c.96 0 1.664.216 2.12.656.448.432.68 1.088.68 1.96v2.584l-.837-.564zm-3.24 1.2c.264 0 .536-.048.824-.144.288-.096.544-.272.76-.512.128-.152.224-.32.272-.512.048-.192.08-.424.08-.696v-.336a6.8 6.8 0 00-.736-.136 6.03 6.03 0 00-.752-.048c-.536 0-.928.104-1.192.32-.264.216-.392.52-.392.92 0 .376.096.656.296.848.192.2.472.296.84.296zm6.44.88c-.144 0-.24-.024-.304-.08-.064-.048-.12-.16-.168-.312L7.684 6.4c-.048-.16-.072-.264-.072-.32 0-.128.064-.2.192-.2h.784c.152 0 .256.024.312.08.064.048.112.16.16.312l1.48 5.824 1.376-5.824c.04-.16.088-.264.152-.312a.53.53 0 01.32-.08h.64c.152 0 .256.024.32.08.064.048.12.16.152.312l1.392 5.896 1.528-5.896c.048-.16.104-.264.16-.312a.488.488 0 01.312-.08h.744c.128 0 .2.064.2.2 0 .04-.008.08-.016.128-.008.048-.024.112-.056.2l-2.128 5.824c-.048.16-.104.264-.168.312-.064.048-.168.08-.304.08h-.688c-.152 0-.256-.024-.32-.08-.064-.056-.12-.16-.152-.32L12.36 7.2l-1.36 5.512c-.04.16-.088.264-.152.32-.064.056-.176.08-.32.08h-.688zm11.348.256c-.416 0-.832-.048-1.232-.144-.4-.096-.712-.2-.92-.32-.128-.072-.216-.152-.248-.224a.56.56 0 01-.048-.224v-.408c0-.168.064-.248.184-.248.048 0 .096.008.144.024.048.016.12.048.2.08.272.12.568.216.888.28.328.064.648.096.976.096.52 0 .92-.088 1.2-.272.28-.184.424-.448.424-.8 0-.232-.072-.424-.224-.576-.152-.152-.44-.288-.864-.416l-1.24-.384c-.624-.192-1.088-.48-1.376-.864-.288-.376-.432-.792-.432-1.24 0-.36.08-.68.24-.952.16-.272.376-.512.648-.704.272-.192.576-.336.928-.432.352-.096.72-.144 1.104-.144.192 0 .392.008.584.04.2.024.384.064.568.104.176.04.344.088.504.144.16.056.288.112.384.168.128.072.216.152.264.24.048.08.072.184.072.312v.376c0 .168-.064.256-.184.256a.836.836 0 01-.304-.096 3.652 3.652 0 00-1.544-.312c-.472 0-.84.072-1.096.224-.256.152-.384.384-.384.704 0 .232.08.432.248.592.168.16.48.32.928.456l1.216.384c.616.192 1.064.464 1.336.816.272.352.408.752.408 1.192 0 .368-.072.704-.216.992-.152.288-.36.544-.632.752-.272.208-.592.36-.96.464-.384.112-.8.168-1.248.168z"/>
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-pdi-granite">AWS Accounts</h3>
                <span className="ml-auto text-xs text-pdi-slate bg-gray-100 px-2 py-0.5 rounded-full">
                  {awsAccounts.length} configured
                </span>
              </div>

              <div className="divide-y divide-pdi-cool-gray">
                {awsAccounts.map((acc) => (
                  <div key={acc.account_id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-pdi-grass shrink-0" />
                      <span className="text-sm font-medium text-pdi-granite">{acc.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-pdi-slate">
                      <span className="font-mono">{acc.account_id}</span>
                      <span className="bg-gray-100 px-1.5 py-0.5 rounded text-pdi-slate">{acc.region}</span>
                    </div>
                  </div>
                ))}
              </div>

              {irsaRole && (
                <div className="mt-4 pt-3 border-t border-pdi-cool-gray">
                  <p className="text-xs text-pdi-slate mb-1">IRSA Role</p>
                  <p className="text-xs font-mono text-pdi-granite truncate" title={irsaRole}>
                    {irsaRole}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Webhooks */}
          <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-md bg-pdi-sky/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-pdi-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-pdi-granite">Webhooks</h3>
            </div>
            {webhooks.length === 0 ? (
              <p className="text-xs text-pdi-slate">Loading webhook configuration...</p>
            ) : (
              <div className="space-y-3">
                {webhooks.map((wh) => (
                  <div key={wh.id} className="border border-pdi-cool-gray rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-pdi-granite">{wh.name}</span>
                        <span className="text-xs bg-gray-100 text-pdi-slate px-2 py-0.5 rounded-full">{wh.auth_type}</span>
                        <span className="text-xs bg-pdi-sky/10 text-pdi-sky px-2 py-0.5 rounded-full">{wh.trigger}</span>
                      </div>
                      {wh.configured ? (
                        <span className="text-xs bg-pdi-grass/10 text-pdi-grass border border-pdi-grass/20 px-2 py-0.5 rounded-full">Configured</span>
                      ) : (
                        <span className="text-xs bg-pdi-sun/10 text-pdi-sun border border-pdi-sun/20 px-2 py-0.5 rounded-full">Not configured</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <code className="text-xs font-mono text-pdi-slate bg-gray-50 border border-pdi-cool-gray rounded px-2 py-1 flex-1 truncate">{wh.url}</code>
                      <button
                        onClick={() => navigator.clipboard.writeText(wh.url)}
                        className="text-xs text-pdi-slate hover:text-pdi-granite px-2 py-1 rounded border border-pdi-cool-gray hover:border-pdi-slate transition-colors shrink-0"
                        title="Copy URL"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(wh.vars).map(([varName, isSet]) => (
                        <div key={varName} className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${isSet ? 'bg-pdi-grass' : 'bg-gray-300'}`} />
                          <span className={`text-xs font-mono ${isSet ? 'text-pdi-granite' : 'text-pdi-slate'}`}>{varName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Development Mode toggle */}
                <div className={`border rounded-lg p-4 ${webhookDevMode ? 'border-pdi-sun/30 bg-pdi-sun/5' : 'border-pdi-cool-gray'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-pdi-granite">Development Mode</span>
                        {webhookDevMode && (
                          <span className="text-xs bg-pdi-sun/15 text-pdi-sun border border-pdi-sun/30 px-2 py-0.5 rounded-full font-medium">Active</span>
                        )}
                      </div>
                      <p className="text-xs text-pdi-slate">
                        When enabled, webhook authentication is bypassed — all incoming webhook requests are accepted without verifying credentials.
                        {webhookDevMode && (
                          <span className="block mt-1 text-pdi-sun font-medium">
                            Warning: disable before going to production.
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      disabled={devModeUpdating}
                      onClick={async () => {
                        setDevModeUpdating(true)
                        try {
                          const result = await api.updateAppSettings({ webhook_dev_mode: !webhookDevMode })
                          setWebhookDevMode(result.webhook_dev_mode)
                        } catch {
                          // ignore
                        } finally {
                          setDevModeUpdating(false)
                        }
                      }}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        webhookDevMode ? 'bg-pdi-sun' : 'bg-gray-200'
                      }`}
                      role="switch"
                      aria-checked={webhookDevMode}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          webhookDevMode ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* System Prompt Additions */}
          <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-pdi-ocean/10 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-pdi-ocean" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-pdi-granite">System Prompt</h3>
                {systemPrompt && (
                  <span className="text-xs bg-pdi-ocean/10 text-pdi-ocean px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              {systemPromptDirty && (
                <span className="text-[10px] text-pdi-slate italic">Unsaved changes</span>
              )}
            </div>

            <p className="text-xs text-pdi-slate mb-3">
              Custom instructions appended to the core investigation prompt. Applied to all investigations (chat, webhooks, manual).
            </p>

            <textarea
              value={systemPromptDraft}
              onChange={(e) => setSystemPromptDraft(e.target.value)}
              placeholder="Enter additional system prompt instructions... (e.g., 'Always check Datadog before concluding an investigation.', 'Prefer concise answers.', 'When investigating PagerDuty incidents, always check related Salesforce cases.')"
              className="w-full min-h-[120px] px-3 py-2.5 border border-pdi-cool-gray rounded-lg text-xs font-mono text-pdi-granite resize-y focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent leading-relaxed"
              spellCheck={false}
            />

            {systemPromptError && (
              <div className="mt-2 text-xs text-pdi-orange bg-pdi-orange/5 border border-pdi-orange/20 rounded-lg px-3 py-2">
                {systemPromptError}
              </div>
            )}

            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] text-pdi-slate/80 italic">
                Persisted to DynamoDB. Survives pod restarts.
              </p>
              <div className="flex items-center gap-2">
                {systemPromptSuccess && (
                  <span className="text-xs text-pdi-grass font-medium flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Saved
                  </span>
                )}
                <button
                  onClick={handleSaveSystemPrompt}
                  disabled={systemPromptSaving || !systemPromptDirty}
                  className="px-3 py-1.5 text-xs text-white bg-pdi-sky rounded-lg font-medium hover:bg-pdi-sky/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {systemPromptSaving ? (
                    <>
                      <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Save &amp; Apply
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* LLM Instructions */}
          <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm">
            {/* Card header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-pdi-cool-gray">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-pdi-indigo/10 flex items-center justify-center">
                  <PencilIcon className="w-3.5 h-3.5 text-pdi-indigo" />
                </div>
                <h3 className="text-sm font-semibold text-pdi-granite">LLM Instructions</h3>
                {customCount > 0 && (
                  <span className="text-xs bg-pdi-sun/15 text-pdi-sun px-2 py-0.5 rounded-full">
                    {customCount} custom
                  </span>
                )}
              </div>
              <button
                onClick={loadLlmInstructions}
                disabled={llmLoading}
                className="text-xs text-pdi-slate hover:text-pdi-granite px-2 py-1 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors disabled:opacity-50"
              >
                {llmLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            {/* Error state */}
            {llmError && (
              <div className="mx-5 mt-4 text-xs text-pdi-orange bg-pdi-orange/5 border border-pdi-orange/20 rounded-lg px-3 py-2">
                {llmError}
              </div>
            )}

            {/* Loading skeleton */}
            {llmLoading && llmIntegrations.length === 0 && (
              <div className="px-5 py-8 text-center text-xs text-pdi-slate">Loading integrations...</div>
            )}

            {/* Split panel */}
            {!llmLoading && llmIntegrations.length > 0 && (
              <div className="flex" style={{ minHeight: '380px' }}>
                {/* Left: integration list */}
                <div className="w-52 shrink-0 border-r border-pdi-cool-gray p-3 space-y-0.5 overflow-y-auto">
                  {llmIntegrations.map((entry) => (
                    <IntegrationRow
                      key={entry.name}
                      entry={entry}
                      isSelected={entry.name === selectedIntegration}
                      onClick={() => setSelectedIntegration(entry.name)}
                    />
                  ))}
                </div>

                {/* Right: editor */}
                <div className="flex-1 p-5">
                  {selectedEntry ? (
                    <EditorPanel
                      key={selectedEntry.name}
                      entry={selectedEntry}
                      onSave={handleSaveInstructions}
                      onReset={handleResetInstructions}
                    />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-pdi-slate">
                      Select an integration to edit its instructions.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!llmLoading && llmIntegrations.length === 0 && !llmError && (
              <div className="px-5 py-8 text-center text-xs text-pdi-slate">
                No integrations loaded. Check that the tool executor is running.
              </div>
            )}
          </div>

          {/* About */}
          <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
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
