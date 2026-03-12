import { useState, useEffect } from 'react'
import { api, type Integration, type ConfigField, type AwsAccount } from '../lib/api'

type StatusFilter = 'all' | 'enabled' | 'disabled' | 'failed'
type TypeFilter = 'all' | 'built-in' | 'mcp' | 'custom' | 'http' | 'database'

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  enabled: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-pdi-grass' },
  disabled: { bg: 'bg-gray-100', text: 'text-pdi-slate', dot: 'bg-pdi-slate' },
  failed: { bg: 'bg-red-50', text: 'text-pdi-orange', dot: 'bg-pdi-orange' },
}

const TYPE_LABELS: Record<string, string> = {
  'built-in': 'Built-in',
  mcp: 'MCP',
  custom: 'Custom',
  http: 'HTTP',
  database: 'Database',
}

function ConfigModal({
  integration,
  onClose,
  onSave,
}: {
  integration: Integration
  onClose: () => void
  onSave: (config: Record<string, unknown>, enabled: boolean) => Promise<void>
}) {
  const [fields, setFields] = useState<Record<string, string>>({})
  const [enabled, setEnabled] = useState(integration.enabled)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')

  // Build the merged field list: schema fields + any extra fields from current config
  const schema = integration.config_schema || []
  const schemaFieldNames = new Set(schema.map((f) => f.name))

  useEffect(() => {
    const initial: Record<string, string> = {}
    // Pre-fill from schema defaults
    for (const field of schema) {
      const currentVal = integration.config?.[field.name]
      if (currentVal !== undefined && currentVal !== null) {
        initial[field.name] = typeof currentVal === 'object' ? JSON.stringify(currentVal) : String(currentVal)
      } else if (field.default !== undefined && field.default !== null) {
        initial[field.name] = String(field.default)
      } else {
        initial[field.name] = ''
      }
    }
    // Add any extra config fields not in schema
    if (integration.config) {
      for (const [k, v] of Object.entries(integration.config)) {
        if (!schemaFieldNames.has(k)) {
          initial[k] = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '')
        }
      }
    }
    setFields(initial)
  }, [integration])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const config: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(fields)) {
        if (v === '') continue // skip empty fields
        const schemaField = schema.find((f) => f.name === k)
        const fieldType = schemaField?.type || 'str'
        if (fieldType === 'bool') config[k] = v === 'true'
        else if (fieldType === 'int') config[k] = parseInt(v, 10)
        else if (fieldType === 'float') config[k] = parseFloat(v)
        else if (fieldType === 'dict' || fieldType === 'list') {
          try { config[k] = JSON.parse(v) } catch { config[k] = v }
        } else {
          config[k] = v
        }
      }
      await onSave(config, enabled)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const addField = () => {
    if (newKey.trim() && !(newKey.trim() in fields)) {
      setFields({ ...fields, [newKey.trim()]: newValue })
      setNewKey('')
      setNewValue('')
    }
  }

  const removeField = (key: string) => {
    const next = { ...fields }
    delete next[key]
    setFields(next)
  }

  // Separate schema fields from extra fields
  const extraFieldKeys = Object.keys(fields).filter((k) => !schemaFieldNames.has(k))

  const hasSchema = schema.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {integration.icon_url ? (
              <img src={integration.icon_url} alt="" className="w-7 h-7 rounded-lg object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-pdi-indigo/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-pdi-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-pdi-granite">{integration.name}</h3>
              <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${
                integration.type === 'mcp' ? 'bg-pdi-ocean/10 text-pdi-ocean' : 'bg-gray-100 text-pdi-slate'
              }`}>
                {TYPE_LABELS[integration.type] || integration.type}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-pdi-slate hover:text-pdi-granite p-1">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Enable toggle */}
          <div className="flex items-center justify-between py-2">
            <span className="text-sm font-medium text-pdi-granite">Enabled</span>
            <button
              onClick={() => setEnabled(!enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-pdi-grass' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {/* Schema-driven fields */}
          {hasSchema && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-pdi-granite uppercase tracking-wide">Configuration</p>
              {schema.map((field: ConfigField) => (
                <div key={field.name}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs font-medium text-pdi-granite">
                      {field.name}
                    </label>
                    {field.required && (
                      <span className="text-[9px] font-bold text-pdi-orange">REQUIRED</span>
                    )}
                    {field.type !== 'str' && (
                      <span className="text-[9px] text-pdi-slate bg-gray-100 px-1 rounded">{field.type}</span>
                    )}
                  </div>
                  {field.description && (
                    <p className="text-[11px] text-pdi-slate mb-1">{field.description}</p>
                  )}
                  {field.type === 'bool' ? (
                    <select
                      value={fields[field.name] || ''}
                      onChange={(e) => setFields({ ...fields, [field.name]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent"
                    >
                      <option value="">— not set —</option>
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type={field.sensitive ? 'password' : 'text'}
                      value={fields[field.name] || ''}
                      onChange={(e) => setFields({ ...fields, [field.name]: e.target.value })}
                      placeholder={field.default !== null && field.default !== undefined ? `Default: ${field.default}` : `Enter ${field.name}`}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent font-mono"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Extra fields (from current config, not in schema) */}
          {extraFieldKeys.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-pdi-granite uppercase tracking-wide">
                {hasSchema ? 'Additional Fields' : 'Configuration'}
              </p>
              {extraFieldKeys.map((key) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-pdi-granite">{key}</label>
                    <button
                      onClick={() => removeField(key)}
                      className="text-pdi-slate hover:text-pdi-orange text-xs"
                      title="Remove field"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <input
                    type="text"
                    value={fields[key]}
                    onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                    placeholder={`Enter ${key}`}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          {/* No schema message */}
          {!hasSchema && extraFieldKeys.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-pdi-slate">
                No configuration required for this integration.
                <br />
                Add custom fields below if needed.
              </p>
            </div>
          )}

          {/* Add new field */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-pdi-granite uppercase tracking-wide mb-2">Add Custom Field</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="Field name"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-pdi-sky"
                onKeyDown={(e) => e.key === 'Enter' && addField()}
              />
              <input
                type="text"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Value"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-pdi-sky"
                onKeyDown={(e) => e.key === 'Enter' && addField()}
              />
              <button
                onClick={addField}
                disabled={!newKey.trim()}
                className="px-3 py-1.5 bg-gray-100 text-pdi-granite rounded-lg text-xs font-medium hover:bg-gray-200 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>

          {error && (
            <div className="text-xs text-pdi-orange bg-pdi-orange/5 border border-pdi-orange/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-pdi-slate hover:text-pdi-granite border border-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm text-white bg-pdi-sky rounded-lg font-medium hover:bg-pdi-sky/90 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save & Apply'}
          </button>
        </div>
      </div>
    </div>
  )
}

function IntegrationCard({
  integration,
  onToggle,
  onConfigure,
  awsAccounts,
}: {
  integration: Integration
  onToggle: (name: string, enabled: boolean) => void
  onConfigure: (integration: Integration) => void
  awsAccounts?: AwsAccount[]
}) {
  const colors = STATUS_COLORS[integration.status] || STATUS_COLORS.disabled
  const [toggling, setToggling] = useState(false)

  const handleToggle = async () => {
    setToggling(true)
    try {
      await onToggle(integration.name, !integration.enabled)
    } finally {
      setToggling(false)
    }
  }

  const hasConfig = (integration.config_schema && integration.config_schema.length > 0) ||
    (integration.config && Object.keys(integration.config).length > 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          {integration.icon_url ? (
            <img
              src={integration.icon_url}
              alt=""
              className="w-8 h-8 rounded-lg object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-pdi-indigo/10 flex items-center justify-center">
              <svg className="w-4 h-4 text-pdi-indigo" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold text-pdi-granite">{integration.name}</h3>
            <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 ${
              integration.type === 'mcp' ? 'bg-pdi-ocean/10 text-pdi-ocean' : 'bg-gray-100 text-pdi-slate'
            }`}>
              {TYPE_LABELS[integration.type] || integration.type}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${colors.bg} ${colors.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {integration.status}
          </span>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
              toggling ? 'opacity-50' : ''
            } ${integration.enabled ? 'bg-pdi-grass' : 'bg-gray-300'}`}
            title={integration.enabled ? 'Disable' : 'Enable'}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              integration.enabled ? 'translate-x-4' : ''
            }`} />
          </button>
        </div>
      </div>

      {integration.description && (
        <p className="text-xs text-pdi-slate leading-relaxed line-clamp-2">
          {integration.description}
        </p>
      )}

      {integration.name === 'aws_api' && awsAccounts && awsAccounts.length > 0 && (
        <div className="space-y-1.5">
          {awsAccounts.map((acc) => (
            <div key={acc.account_id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pdi-grass shrink-0" />
                <span className="text-pdi-granite font-medium">{acc.name}</span>
              </span>
              <span className="text-pdi-slate font-mono">{acc.account_id}</span>
            </div>
          ))}
        </div>
      )}

      {integration.error && (
        <div className="text-xs text-pdi-orange bg-pdi-orange/5 border border-pdi-orange/20 rounded-lg px-3 py-2">
          {integration.error}
        </div>
      )}

      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
        <span className="text-[11px] text-pdi-slate">
          {integration.tool_count} tool{integration.tool_count !== 1 ? 's' : ''}
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onConfigure(integration)}
            className={`text-[11px] flex items-center gap-1 ${
              hasConfig ? 'text-pdi-sky hover:underline' : 'text-pdi-slate hover:text-pdi-sky'
            }`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure
          </button>
          {integration.docs_url && (
            <a
              href={integration.docs_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-pdi-sky hover:underline flex items-center gap-1"
            >
              Docs
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Integrations() {
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [configuring, setConfiguring] = useState<Integration | null>(null)
  const [awsAccounts, setAwsAccounts] = useState<AwsAccount[]>([])

  useEffect(() => {
    loadIntegrations()
    api.getAwsAccounts().then((data) => setAwsAccounts(data.accounts)).catch(() => {})
  }, [])

  async function loadIntegrations() {
    try {
      setLoading(true)
      setError(null)
      const data = await api.getIntegrations()
      setIntegrations(data.integrations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations')
    } finally {
      setLoading(false)
    }
  }

  async function handleToggle(name: string, enabled: boolean) {
    try {
      setError(null)
      await api.toggleIntegration(name, enabled)
      await loadIntegrations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle integration')
    }
  }

  async function handleSaveConfig(config: Record<string, unknown>, enabled: boolean) {
    if (!configuring) return
    setError(null)
    await api.updateIntegrationConfig(configuring.name, config, enabled)
    await loadIntegrations()
  }

  const filtered = integrations.filter((i) => {
    if (statusFilter !== 'all' && i.status !== statusFilter) return false
    if (typeFilter !== 'all' && i.type !== typeFilter) return false
    return true
  })

  const enabledCount = integrations.filter((i) => i.status === 'enabled').length
  const failedCount = integrations.filter((i) => i.status === 'failed').length
  const mcpCount = integrations.filter((i) => i.type === 'mcp').length

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-pdi-granite">Integrations</h2>
            <p className="text-xs text-pdi-slate">Connected data sources and MCP servers</p>
          </div>
          <button
            onClick={loadIntegrations}
            disabled={loading}
            className="text-xs text-pdi-slate hover:text-pdi-granite px-3 py-1.5 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-pdi-slate font-medium">Active</p>
              <p className="text-2xl font-bold text-pdi-grass mt-1">{enabledCount}</p>
              <p className="text-[11px] text-pdi-slate mt-0.5">of {integrations.length} total</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-pdi-slate font-medium">Failed</p>
              <p className={`text-2xl font-bold mt-1 ${failedCount > 0 ? 'text-pdi-orange' : 'text-pdi-granite'}`}>{failedCount}</p>
              <p className="text-[11px] text-pdi-slate mt-0.5">need attention</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <p className="text-xs text-pdi-slate font-medium">MCP Servers</p>
              <p className="text-2xl font-bold text-pdi-ocean mt-1">{mcpCount}</p>
              <p className="text-[11px] text-pdi-slate mt-0.5">external integrations</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-pdi-granite bg-white focus:outline-none focus:ring-1 focus:ring-pdi-sky"
            >
              <option value="all">All statuses</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-pdi-granite bg-white focus:outline-none focus:ring-1 focus:ring-pdi-sky"
            >
              <option value="all">All types</option>
              <option value="built-in">Built-in</option>
              <option value="mcp">MCP</option>
              <option value="custom">Custom</option>
            </select>
            {(statusFilter !== 'all' || typeFilter !== 'all') && (
              <button
                onClick={() => { setStatusFilter('all'); setTypeFilter('all') }}
                className="text-xs text-pdi-sky hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-pdi-orange/10 border border-pdi-orange/30 rounded-xl p-4 text-sm text-pdi-orange">
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && integrations.length === 0 && (
            <div className="text-center py-12 text-pdi-slate text-sm">Loading integrations...</div>
          )}

          {/* Cards grid */}
          {filtered.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((integration) => (
                <IntegrationCard
                  key={integration.name}
                  integration={integration}
                  onToggle={handleToggle}
                  onConfigure={setConfiguring}
                  awsAccounts={awsAccounts}
                />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && integrations.length > 0 && (
            <div className="text-center py-12 text-pdi-slate text-sm">
              No integrations match the current filters.
            </div>
          )}
        </div>
      </div>

      {/* Config modal */}
      {configuring && (
        <ConfigModal
          integration={configuring}
          onClose={() => setConfiguring(null)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  )
}
