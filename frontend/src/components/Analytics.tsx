import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { api, Investigation } from '../lib/api'
import { useAnalytics, SOURCE_COLORS } from '../hooks/useAnalytics'
import StatsCards from './StatsCards'

const RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-5">
      <h3 className="text-sm font-semibold text-pdi-granite mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function Analytics() {
  const [rangeDays, setRangeDays] = useState(7)
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - rangeDays)
      const data = await api.getInvestigations({
        start_date: startDate.toISOString(),
        limit: 10000,
      })
      setInvestigations(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load investigations')
    } finally {
      setLoading(false)
    }
  }, [rangeDays])

  useEffect(() => {
    load()
  }, [load])

  const analytics = useAnalytics(investigations)

  // Derive the unique source keys from volumeBySource for stacked bars
  const sourceKeys = analytics.activeSources.length > 0
    ? analytics.activeSources
    : Object.keys(SOURCE_COLORS)

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="relative px-6 py-4 border-b border-pdi-cool-gray bg-white -mx-6 -mt-8 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-pdi-granite">Analytics</h2>
              <p className="text-xs text-pdi-slate">Investigation metrics and trends</p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {RANGES.map((r) => (
                <button
                  key={r.label}
                  onClick={() => setRangeDays(r.days)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    rangeDays === r.days
                      ? 'bg-white text-pdi-indigo shadow-sm'
                      : 'text-pdi-slate hover:text-pdi-granite'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pdi-sky via-pdi-ocean to-pdi-indigo opacity-60" />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <svg className="w-8 h-8 animate-spin text-pdi-sky" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="mb-4 px-4 py-3 bg-pdi-orange/10 border border-pdi-orange/20 rounded-lg text-sm text-pdi-orange">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && investigations.length === 0 && (
          <div className="text-center py-16 text-pdi-slate">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75z" />
            </svg>
            <p className="text-sm">No investigations found for this time range.</p>
          </div>
        )}

        {/* Dashboard */}
        {!loading && !error && investigations.length > 0 && (
          <>
            {/* Stats cards */}
            <div className="mb-6">
              <StatsCards investigations={investigations} />
            </div>

            {/* Charts grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Row 1 */}
              <ChartPanel title="Investigation Volume by Source">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.volumeBySource}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend />
                    {sourceKeys.map((src) => (
                      <Bar
                        key={src}
                        dataKey={src}
                        stackId="volume"
                        fill={SOURCE_COLORS[src] || '#94A3B8'}
                        name={src}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Source Breakdown">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.sourceBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {analytics.sourceBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* Row 2 */}
              <ChartPanel title="Success / Failure Rate">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.statusBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    {analytics.statusBreakdown.map((entry, i) => (
                      <Bar key={i} dataKey="value" fill={entry.color} name={entry.name}>
                        {analytics.statusBreakdown.map((e, j) => (
                          <Cell key={j} fill={e.color} />
                        ))}
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Feedback Stats">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analytics.feedbackStats}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {analytics.feedbackStats.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* Row 3 */}
              <ChartPanel title="Average Duration Trend">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={analytics.avgDurationTrend.map((d) => ({ ...d, avgSec: d.avgMs / 1000 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="s" />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}s`, 'Avg Duration']} />
                    <Line
                      type="monotone"
                      dataKey="avgSec"
                      stroke="#0EA5E9"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      name="Avg Duration"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartPanel>

              <ChartPanel title="Tool Usage Ranking (Top 15)">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.toolRanking} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <YAxis dataKey="tool" type="category" tick={{ fontSize: 10 }} width={120} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366F1" name="Calls" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              {/* Row 4 */}
              <ChartPanel title="Project Comparison">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.projectComparison}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="project" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0284C7" name="Investigations" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>

              {analytics.hasTokenData ? (
                <ChartPanel title="Token Usage & Cost">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analytics.tokenCosts}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="tokens" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 11 }} unit="$" />
                      <Tooltip />
                      <Legend />
                      <Line
                        yAxisId="tokens"
                        type="monotone"
                        dataKey="totalTokens"
                        stroke="#6366F1"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Total Tokens"
                      />
                      <Line
                        yAxisId="cost"
                        type="monotone"
                        dataKey="costUsd"
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        name="Cost (USD)"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartPanel>
              ) : (
                <ChartPanel title="Token Usage & Cost">
                  <div className="flex items-center justify-center h-[250px] text-pdi-slate">
                    <div className="text-center">
                      <svg className="w-10 h-10 mx-auto mb-2 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm">Collecting data</p>
                      <p className="text-xs mt-1 opacity-60">Token metadata will appear after more investigations</p>
                    </div>
                  </div>
                </ChartPanel>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
