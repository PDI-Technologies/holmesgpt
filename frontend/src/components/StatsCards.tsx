import type { Investigation } from '../lib/api'
import { useAnalytics } from '../hooks/useAnalytics'

interface StatsCardsProps {
  investigations: Investigation[]
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '--'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const secs = ms / 1000
  if (secs < 60) return `${Math.round(secs)}s`
  const mins = secs / 60
  return `${mins.toFixed(1)}m`
}

export default function StatsCards({ investigations }: StatsCardsProps) {
  const data = useAnalytics(investigations)

  const cards = [
    {
      label: 'Total Investigations',
      value: String(data.total),
      sub: `${data.completed} completed, ${data.failed} failed`,
      color: 'text-pdi-indigo',
      bg: 'bg-pdi-indigo/10',
    },
    {
      label: 'Success Rate',
      value: `${data.successRate.toFixed(1)}%`,
      sub: `${data.completed} of ${data.total}`,
      color: data.successRate >= 90 ? 'text-pdi-grass' : data.successRate >= 70 ? 'text-pdi-sun' : 'text-pdi-orange',
      bg: data.successRate >= 90 ? 'bg-pdi-grass/10' : data.successRate >= 70 ? 'bg-pdi-sun/10' : 'bg-pdi-orange/10',
    },
    {
      label: 'Avg Duration',
      value: formatDuration(data.avgDurationMs),
      sub: `across ${investigations.filter((i) => i.finished_at).length} investigations`,
      color: 'text-pdi-ocean',
      bg: 'bg-pdi-ocean/10',
    },
    {
      label: 'Active Sources',
      value: String(data.activeSources.length),
      sub: data.activeSources.slice(0, 3).join(', ') || 'none',
      color: 'text-pdi-plum',
      bg: 'bg-pdi-plum/10',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="bg-white rounded-xl border border-pdi-cool-gray shadow-sm p-4">
          <p className="text-xs text-pdi-slate font-medium mb-1">{card.label}</p>
          <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          <p className="text-xs text-pdi-slate mt-1 truncate">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
