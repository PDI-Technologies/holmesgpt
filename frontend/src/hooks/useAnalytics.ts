import { useMemo } from 'react'
import type { Investigation } from '../lib/api'

export const SOURCE_COLORS: Record<string, string> = {
  ui: '#0EA5E9',
  pagerduty: '#22C55E',
  ado: '#0284C7',
  salesforce: '#A855F7',
  cli: '#64748B',
  webhook: '#F59E0B',
}

export const STATUS_COLORS = {
  completed: '#22C55E',
  failed: '#F97316',
}

export const FEEDBACK_COLORS = {
  helpful: '#22C55E',
  not_helpful: '#F97316',
  unrated: '#CBD5E1',
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 },
}

function getDurationMs(inv: Investigation): number | null {
  if (!inv.started_at || !inv.finished_at) return null
  const start = new Date(inv.started_at).getTime()
  const end = new Date(inv.finished_at).getTime()
  if (isNaN(start) || isNaN(end)) return null
  return end - start
}

function getDateKey(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10)
  } catch {
    return 'unknown'
  }
}

export interface AnalyticsData {
  total: number
  completed: number
  failed: number
  successRate: number
  avgDurationMs: number | null
  activeSources: string[]
  volumeBySource: { date: string; [source: string]: string | number }[]
  sourceBreakdown: { name: string; value: number; color: string }[]
  statusBreakdown: { name: string; value: number; color: string }[]
  feedbackStats: { name: string; value: number; color: string }[]
  avgDurationTrend: { date: string; avgMs: number }[]
  toolRanking: { tool: string; count: number }[]
  projectComparison: { project: string; count: number }[]
  tokenCosts: { date: string; totalTokens: number; costUsd: number }[]
  hasTokenData: boolean
}

export function useAnalytics(investigations: Investigation[]): AnalyticsData {
  return useMemo(() => {
    const total = investigations.length
    const completed = investigations.filter((i) => i.status === 'completed').length
    const failed = investigations.filter((i) => i.status === 'failed').length
    const successRate = total > 0 ? (completed / total) * 100 : 0

    const durations = investigations.map(getDurationMs).filter((d): d is number => d !== null && d > 0)
    const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null

    const activeSources = [...new Set(investigations.map((i) => i.source).filter(Boolean))]

    const dateSourceMap: Record<string, Record<string, number>> = {}
    for (const inv of investigations) {
      const date = getDateKey(inv.started_at)
      if (!dateSourceMap[date]) dateSourceMap[date] = {}
      const src = inv.source || 'unknown'
      dateSourceMap[date][src] = (dateSourceMap[date][src] || 0) + 1
    }
    const volumeBySource = Object.entries(dateSourceMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sources]) => ({ date, ...sources }))

    const sourceCounts: Record<string, number> = {}
    for (const inv of investigations) {
      const src = inv.source || 'unknown'
      sourceCounts[src] = (sourceCounts[src] || 0) + 1
    }
    const sourceBreakdown = Object.entries(sourceCounts).map(([name, value]) => ({
      name,
      value,
      color: SOURCE_COLORS[name] || '#94A3B8',
    }))

    const statusBreakdown = [
      { name: 'Completed', value: completed, color: STATUS_COLORS.completed },
      { name: 'Failed', value: failed, color: STATUS_COLORS.failed },
    ].filter((s) => s.value > 0)

    const helpful = investigations.filter((i) => i.feedback === 'helpful').length
    const notHelpful = investigations.filter((i) => i.feedback === 'not_helpful').length
    const unrated = investigations.filter((i) => !i.feedback).length
    const feedbackStats = [
      { name: 'Helpful', value: helpful, color: FEEDBACK_COLORS.helpful },
      { name: 'Not Helpful', value: notHelpful, color: FEEDBACK_COLORS.not_helpful },
      { name: 'Unrated', value: unrated, color: FEEDBACK_COLORS.unrated },
    ].filter((s) => s.value > 0)

    const dateDurations: Record<string, number[]> = {}
    for (const inv of investigations) {
      const d = getDurationMs(inv)
      if (d !== null && d > 0) {
        const date = getDateKey(inv.started_at)
        if (!dateDurations[date]) dateDurations[date] = []
        dateDurations[date].push(d)
      }
    }
    const avgDurationTrend = Object.entries(dateDurations)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, ds]) => ({ date, avgMs: ds.reduce((a, b) => a + b, 0) / ds.length }))

    const toolCounts: Record<string, number> = {}
    for (const inv of investigations) {
      for (const tc of inv.tool_calls || []) {
        toolCounts[tc.tool_name] = (toolCounts[tc.tool_name] || 0) + 1
      }
    }
    const toolRanking = Object.entries(toolCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([tool, count]) => ({ tool, count }))

    const projectCounts: Record<string, number> = {}
    for (const inv of investigations) {
      const proj = inv.project_id || '(no project)'
      projectCounts[proj] = (projectCounts[proj] || 0) + 1
    }
    const projectComparison = Object.entries(projectCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([project, count]) => ({ project, count }))

    const withMeta = investigations.filter((i) => i.metadata?.total_tokens)
    const hasTokenData = withMeta.length >= 5
    const dateTokens: Record<string, { tokens: number; cost: number }> = {}
    for (const inv of withMeta) {
      const date = getDateKey(inv.started_at)
      const m = inv.metadata!
      const model = m.model || ''
      const pricing = MODEL_PRICING[model] || { input: 3.0, output: 15.0 }
      const cost = ((m.prompt_tokens || 0) * pricing.input + (m.completion_tokens || 0) * pricing.output) / 1_000_000
      if (!dateTokens[date]) dateTokens[date] = { tokens: 0, cost: 0 }
      dateTokens[date].tokens += m.total_tokens || 0
      dateTokens[date].cost += cost
    }
    const tokenCosts = Object.entries(dateTokens)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, totalTokens: d.tokens, costUsd: Math.round(d.cost * 100) / 100 }))

    return {
      total, completed, failed, successRate, avgDurationMs, activeSources,
      volumeBySource, sourceBreakdown, statusBreakdown, feedbackStats,
      avgDurationTrend, toolRanking, projectComparison, tokenCosts, hasTokenData,
    }
  }, [investigations])
}
