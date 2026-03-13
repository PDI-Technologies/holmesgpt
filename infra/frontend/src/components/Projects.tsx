import { useState, useEffect } from 'react'
import { api, Project, ToolsetInstance, AwsAccount } from '../lib/api'

interface ProjectsProps {
  projects: Project[]
  onReload: () => void
}

interface InstanceRow {
  type: string
  name: string
  secret_arn: string
  /** For MCP toolsets: optional URL override */
  mcp_url: string
  /** For aws_api: comma-separated list of allowed account profile names */
  aws_accounts: string
}

const TOOLSET_TYPES = [
  'grafana/dashboards',
  'grafana/loki',
  'grafana/tempo',
  'prometheus/metrics',
  'aws_api',
  'ado',
  'atlassian',
  'salesforce',
]

const MCP_TYPES = new Set(['ado', 'atlassian', 'salesforce'])

function InstanceEditor({
  instances,
  onChange,
  awsAccounts,
}: {
  instances: InstanceRow[]
  onChange: (rows: InstanceRow[]) => void
  awsAccounts: AwsAccount[]
}) {
  const add = () =>
    onChange([...instances, { type: TOOLSET_TYPES[0], name: '', secret_arn: '', mcp_url: '', aws_accounts: '' }])

  const remove = (i: number) => onChange(instances.filter((_, idx) => idx !== i))

  const update = (i: number, field: keyof InstanceRow, value: string) => {
    const next = instances.map((row, idx) => (idx === i ? { ...row, [field]: value } : row))
    onChange(next)
  }

  const toggleAwsAccount = (i: number, accountName: string) => {
    const row = instances[i]
    const current = row.aws_accounts ? row.aws_accounts.split(',').map(s => s.trim()).filter(Boolean) : []
    const updated = current.includes(accountName)
      ? current.filter(a => a !== accountName)
      : [...current, accountName]
    update(i, 'aws_accounts', updated.join(', '))
  }

  return (
    <div className="space-y-4">
      {instances.map((row, i) => (
        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="flex gap-2 items-start">
            <select
              value={row.type}
              onChange={(e) => update(i, 'type', e.target.value)}
              className="flex-shrink-0 w-44 text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-pdi-sky"
            >
              {TOOLSET_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Instance name (e.g. grafana-logistics)"
              value={row.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              className="flex-1 text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pdi-sky"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-gray-400 hover:text-red-500 transition-colors mt-1.5 shrink-0"
              title="Remove"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* MCP toolset fields */}
          {MCP_TYPES.has(row.type) && (
            <div className="space-y-2 pl-1">
              <input
                type="text"
                placeholder="API Key Secret ARN (required for per-project key)"
                value={row.secret_arn}
                onChange={(e) => update(i, 'secret_arn', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pdi-sky"
              />
              <input
                type="text"
                placeholder="MCP server URL override (optional — leave blank to use global)"
                value={row.mcp_url}
                onChange={(e) => update(i, 'mcp_url', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pdi-sky"
              />
              <p className="text-xs text-gray-400">
                Secret must contain <code className="bg-gray-100 px-1 rounded">api_key</code> field.
                Leave Secret ARN blank to reuse the globally configured API key.
              </p>
            </div>
          )}

          {/* Python toolset (grafana, prometheus) secret ARN */}
          {!MCP_TYPES.has(row.type) && row.type !== 'aws_api' && (
            <div className="pl-1">
              <input
                type="text"
                placeholder="Secret ARN (optional — leave blank for global credentials)"
                value={row.secret_arn}
                onChange={(e) => update(i, 'secret_arn', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-pdi-sky"
              />
            </div>
          )}

          {/* AWS account scoping */}
          {row.type === 'aws_api' && (
            <div className="pl-1 space-y-1.5">
              {awsAccounts.length > 0 ? (
                <>
                  <p className="text-xs font-medium text-gray-600">
                    Allowed AWS accounts (leave all unchecked to allow all):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {awsAccounts.map((acct) => {
                      const selected = row.aws_accounts
                        ? row.aws_accounts.split(',').map(s => s.trim()).includes(acct.name)
                        : false
                      return (
                        <button
                          key={acct.name}
                          type="button"
                          onClick={() => toggleAwsAccount(i, acct.name)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            selected
                              ? 'bg-amber-100 border-amber-400 text-amber-800'
                              : 'bg-white border-gray-300 text-gray-600 hover:border-amber-300'
                          }`}
                        >
                          {acct.name}
                          <span className="ml-1 text-gray-400">{acct.account_id}</span>
                        </button>
                      )
                    })}
                  </div>
                  {row.aws_accounts && (
                    <p className="text-xs text-gray-400">
                      Scoped to: {row.aws_accounts}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-400">
                  No AWS accounts configured globally. Add accounts via Terraform <code className="bg-gray-100 px-1 rounded">logistics_accounts</code> variable.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 text-sm text-pdi-sky hover:text-pdi-indigo transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Add instance
      </button>
    </div>
  )
}

function ProjectModal({
  project,
  onClose,
  onSave,
}: {
  project: Project | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [instances, setInstances] = useState<InstanceRow[]>(
    project?.instances.map((i) => ({
      type: i.type,
      name: i.name,
      secret_arn: i.secret_arn ?? '',
      mcp_url: i.mcp_url ?? '',
      aws_accounts: i.aws_accounts ? i.aws_accounts.join(', ') : '',
    })) ?? []
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [awsAccounts, setAwsAccounts] = useState<AwsAccount[]>([])

  useEffect(() => {
    api.getAwsAccounts().then((data) => setAwsAccounts(data.accounts)).catch(() => {})
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Project name is required')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        instances: instances
          .filter((r) => r.name.trim())
          .map(
            (r): ToolsetInstance => ({
              type: r.type,
              name: r.name.trim(),
              secret_arn: r.secret_arn.trim() || null,
              mcp_url: r.mcp_url.trim() || null,
              aws_accounts: r.aws_accounts.trim()
                ? r.aws_accounts.split(',').map(s => s.trim()).filter(Boolean)
                : null,
            })
          ),
      }
      if (project) {
        await api.updateProject(project.id, payload)
      } else {
        await api.createProject(payload)
      }
      onSave()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {project ? 'Edit Project' : 'Create Project'}
          </h2>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Logistics Cloud"
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pdi-sky"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pdi-sky"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Integration Instances
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Add the integrations this project should use. Leave credentials blank to reuse globally configured ones.
              For AWS, select which accounts are in scope for this project.
            </p>
            <InstanceEditor instances={instances} onChange={setInstances} awsAccounts={awsAccounts} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-pdi-sky rounded-lg hover:bg-pdi-indigo transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Project'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Projects({ projects, onReload }: ProjectsProps) {
  const [editingProject, setEditingProject] = useState<Project | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project? This cannot be undone.')) return
    setDeleting(id)
    try {
      await api.deleteProject(id)
      onReload()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete project')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-sm text-gray-500 mt-1">
              Group integration instances per team or environment. Select a project in the sidebar to scope your chat.
            </p>
          </div>
          <button
            onClick={() => setEditingProject(null)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-pdi-sky rounded-lg hover:bg-pdi-indigo transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-sm">No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{p.name}</h3>
                  {p.description && (
                    <p className="text-sm text-gray-500 mt-0.5 truncate">{p.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.instances.map((inst, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-pdi-sky/10 text-pdi-indigo"
                      >
                        {inst.name}
                        {inst.secret_arn && (
                          <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        )}
                        {inst.aws_accounts && inst.aws_accounts.length > 0 && (
                          <span className="text-amber-600 font-normal">
                            ({inst.aws_accounts.length} acct{inst.aws_accounts.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </span>
                    ))}
                    {p.instances.length === 0 && (
                      <span className="text-xs text-gray-400">No instances configured</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setEditingProject(p)}
                    className="p-1.5 text-gray-400 hover:text-pdi-sky transition-colors rounded"
                    title="Edit"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded disabled:opacity-40"
                    title="Delete"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingProject !== undefined && (
        <ProjectModal
          project={editingProject}
          onClose={() => setEditingProject(undefined)}
          onSave={onReload}
        />
      )}
    </div>
  )
}
