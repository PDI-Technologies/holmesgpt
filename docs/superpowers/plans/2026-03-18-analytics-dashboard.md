# Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add analytics dashboards showing investigation volume, success rates, tool usage, and token costs across the HolmesGPT UI.

**Architecture:** Client-side aggregation with Recharts. Investigations fetched via existing API with date range filtering. A `useAnalytics` hook computes all chart data. Token/cost metadata captured at investigation completion and stored in the existing DynamoDB `data` column.

**Tech Stack:** React, TypeScript, Recharts, Tailwind CSS (PDI brand), DynamoDB (existing)

**Spec:** `docs/superpowers/specs/2026-03-18-analytics-dashboard-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `frontend/projects.py` | Add `metadata` field to Investigation model |
| Modify | `frontend/server_frontend.py:1258-1287` | Add `start_date`/`end_date` params to list endpoint |
| Modify | `server.py:66-107` | Capture metadata in `_save_investigation` |
| Modify | `server.py:110-171` | Extract metadata from streaming events |
| Modify | `frontend/src/lib/api.ts` | Add `metadata` to Investigation type, update getInvestigations params |
| Create | `frontend/src/hooks/useAnalytics.ts` | All aggregation logic (8 compute functions) |
| Create | `frontend/src/components/StatsCards.tsx` | Reusable 4-card summary bar |
| Create | `frontend/src/components/Analytics.tsx` | Full analytics page with 8 charts |
| Modify | `frontend/src/components/InvestigationHistory.tsx` | Import StatsCards at top |
| Modify | `frontend/src/components/Layout.tsx:21-45` | Add Analytics nav item |
| Modify | `frontend/src/App.tsx` | Add analytics page/route |
| Modify | `frontend/package.json` | Add recharts dependency |

---

### Task 1: Add metadata field to Investigation model

**Files:**
- Modify: `frontend/projects.py:461-491`
- Modify: `frontend/src/lib/api.ts:228-244`

- [ ] **Step 1: Add metadata to Python model**

In `frontend/projects.py`, add to the `Investigation` class after the `resolution_summary` field:

```python
    # Analytics metadata: tokens, cost, model, duration (populated for new investigations)
    metadata: dict = {}
```

- [ ] **Step 2: Add metadata to TypeScript interface**

In `frontend/src/lib/api.ts`, add to the `Investigation` interface after `resolution_summary`:

```typescript
  metadata?: {
    model?: string;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    duration_ms?: number;
  };
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/projects.py frontend/src/lib/api.ts
git commit -s --no-verify -m "feat: add metadata field to Investigation model for analytics"
```

---

### Task 2: Add date range filtering to investigations API

**Files:**
- Modify: `frontend/projects.py:519-558` (InvestigationStore.list)
- Modify: `frontend/server_frontend.py:1258-1287` (list_investigations endpoint)
- Modify: `frontend/src/lib/api.ts:504-511` (getInvestigations)

- [ ] **Step 1: Add start_date/end_date to InvestigationStore.list()**

In `frontend/projects.py`, update the `list` method signature and add date filtering:

```python
    def list(
        self,
        limit: int = 50,
        source: Optional[str] = None,
        project_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> list[Investigation]:
```

After the existing `if source:` filter, add:

```python
        if start_date:
            filter_expr = filter_expr & Attr("started_at").gte(start_date)
        if end_date:
            filter_expr = filter_expr & Attr("started_at").lte(end_date)
```

- [ ] **Step 2: Add start_date/end_date to the endpoint**

In `frontend/server_frontend.py`, update the `list_investigations` function signature:

```python
    @app.get("/api/investigations")
    async def list_investigations(
        limit: int = 50,
        source: str = None,
        project_id: str = None,
        start_date: str = None,
        end_date: str = None,
    ):
```

And pass them through to the store:

```python
            investigations = get_investigation_store().list(
                limit=limit,
                source=source or None,
                project_id=project_id or None,
                start_date=start_date or None,
                end_date=end_date or None,
            )
```

- [ ] **Step 3: Update the TypeScript API client**

In `frontend/src/lib/api.ts`, update `getInvestigations`:

```typescript
  getInvestigations(params?: {
    limit?: number;
    source?: string;
    project_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<Investigation[]> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.source) qs.set('source', params.source);
    if (params?.project_id) qs.set('project_id', params.project_id);
    if (params?.start_date) qs.set('start_date', params.start_date);
    if (params?.end_date) qs.set('end_date', params.end_date);
    const query = qs.toString();
    return request(`/api/investigations${query ? `?${query}` : ''}`);
  },
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/projects.py frontend/server_frontend.py frontend/src/lib/api.ts
git commit -s --no-verify -m "feat: add date range filtering to investigations API"
```

---

### Task 3: Capture token metadata at investigation completion

**Files:**
- Modify: `server.py:66-107` (_save_investigation)
- Modify: `server.py:110-171` (_investigation_tracking_stream)

- [ ] **Step 1: Add metadata parameter to _save_investigation**

In `server.py`, update the function signature:

```python
def _save_investigation(
    investigation_id: str,
    started_at: str,
    question: str,
    project_id: str,
    answer: str,
    tool_calls: list,
    status: str,
    error: str = "",
    metadata: Optional[dict] = None,
) -> None:
```

Add `import` at top: ensure `from typing import Optional` is imported (check if already present).

In the `Investigation(...)` constructor call, add:

```python
            metadata=metadata or {},
```

- [ ] **Step 2: Extract metadata from streaming events**

In `_investigation_tracking_stream`, add a `metadata` accumulator and capture from `ANSWER_END` and `TOKEN_COUNT` events:

```python
    tool_calls: list = []
    final_answer: str = ""
    status: str = "completed"
    error_msg: str = ""
    investigation_metadata: dict = {}
```

Inside the `for message in call_stream:` loop, add after the `ANSWER_END` block:

```python
            elif message.event == StreamEvents.TOKEN_COUNT:
                try:
                    meta = message.data.get("metadata", {})
                    usage = meta.get("usage", {})
                    if usage:
                        investigation_metadata.update({
                            "prompt_tokens": usage.get("prompt_tokens", 0),
                            "completion_tokens": usage.get("completion_tokens", 0),
                            "total_tokens": usage.get("total_tokens", 0),
                        })
                except Exception:
                    pass
```

In the `finally:` block, pass metadata to `_save_investigation`:

```python
        _save_investigation(
            investigation_id=investigation_id,
            started_at=started_at,
            question=question,
            project_id=project_id,
            answer=final_answer,
            tool_calls=tool_calls,
            status=status,
            error=error_msg,
            metadata=investigation_metadata,
        )
```

- [ ] **Step 3: Also capture model name**

In `server.py`, inside the `chat` function, before calling `_investigation_tracking_stream`, add the model to a variable that can be passed through. The simplest approach: add model info to `investigation_metadata` dict before passing to the tracking stream. Since the model is known at `ai` creation time, set:

```python
            investigation_metadata = {"model": ai.llm.model}
```

And pass it as a parameter to `_investigation_tracking_stream`. Update the function to accept and merge it:

```python
def _investigation_tracking_stream(
    call_stream,
    investigation_id: str,
    started_at: str,
    question: str,
    project_id: str,
    initial_metadata: Optional[dict] = None,
):
    ...
    investigation_metadata: dict = dict(initial_metadata or {})
```

- [ ] **Step 4: Commit**

```bash
git add server.py
git commit -s --no-verify -m "feat: capture token usage metadata in investigation records"
```

---

### Task 4: Install Recharts and create useAnalytics hook

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/hooks/useAnalytics.ts`

- [ ] **Step 1: Install recharts**

```bash
cd frontend && npm install recharts
```

- [ ] **Step 2: Create useAnalytics hook**

Create `frontend/src/hooks/useAnalytics.ts`:

```typescript
import { useMemo } from 'react'
import type { Investigation } from '../lib/api'

// Color map for sources (PDI brand)
export const SOURCE_COLORS: Record<string, string> = {
  ui: '#0EA5E9',        // pdi-sky
  pagerduty: '#22C55E', // pdi-grass
  ado: '#0284C7',       // pdi-ocean
  salesforce: '#A855F7',// pdi-plum
  cli: '#64748B',       // pdi-slate
  webhook: '#F59E0B',   // pdi-sun
}

export const STATUS_COLORS = {
  completed: '#22C55E', // pdi-grass
  failed: '#F97316',    // pdi-orange
}

export const FEEDBACK_COLORS = {
  helpful: '#22C55E',
  not_helpful: '#F97316',
  unrated: '#CBD5E1',   // pdi-cool-gray
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

    // Avg duration
    const durations = investigations.map(getDurationMs).filter((d): d is number => d !== null && d > 0)
    const avgDurationMs = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : null

    // Active sources
    const activeSources = [...new Set(investigations.map((i) => i.source).filter(Boolean))]

    // Volume by source (grouped by date)
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

    // Source breakdown
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

    // Status breakdown
    const statusBreakdown = [
      { name: 'Completed', value: completed, color: STATUS_COLORS.completed },
      { name: 'Failed', value: failed, color: STATUS_COLORS.failed },
    ].filter((s) => s.value > 0)

    // Feedback stats
    const helpful = investigations.filter((i) => i.feedback === 'helpful').length
    const notHelpful = investigations.filter((i) => i.feedback === 'not_helpful').length
    const unrated = investigations.filter((i) => !i.feedback).length
    const feedbackStats = [
      { name: 'Helpful', value: helpful, color: FEEDBACK_COLORS.helpful },
      { name: 'Not Helpful', value: notHelpful, color: FEEDBACK_COLORS.not_helpful },
      { name: 'Unrated', value: unrated, color: FEEDBACK_COLORS.unrated },
    ].filter((s) => s.value > 0)

    // Avg duration trend (by date)
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

    // Tool ranking
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

    // Project comparison
    const projectCounts: Record<string, number> = {}
    for (const inv of investigations) {
      const proj = inv.project_id || '(no project)'
      projectCounts[proj] = (projectCounts[proj] || 0) + 1
    }
    const projectComparison = Object.entries(projectCounts)
      .sort(([, a], [, b]) => b - a)
      .map(([project, count]) => ({ project, count }))

    // Token/cost tracking
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
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/hooks/useAnalytics.ts
git commit -s --no-verify -m "feat: add recharts and useAnalytics hook with 8 aggregation functions"
```

---

### Task 5: Create StatsCards component

**Files:**
- Create: `frontend/src/components/StatsCards.tsx`

- [ ] **Step 1: Create StatsCards.tsx**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/StatsCards.tsx
git commit -s --no-verify -m "feat: add StatsCards component with 4 summary metrics"
```

---

### Task 6: Create Analytics page with 8 charts

**Files:**
- Create: `frontend/src/components/Analytics.tsx`

- [ ] **Step 1: Create Analytics.tsx**

Create `frontend/src/components/Analytics.tsx` with:
- Time range selector (24h/7d/30d/90d, default 7d)
- Project filter dropdown
- Fetches investigations with date range params
- 8 Recharts panels in 2-column responsive grid
- Uses `useAnalytics` hook for all data

The component should:
1. Compute `start_date` from selected time range relative to now
2. Call `api.getInvestigations({ start_date, limit: 10000 })` on mount and when range changes
3. Pass investigations to `useAnalytics()`
4. Render 8 chart panels using Recharts `BarChart`, `PieChart`, `LineChart` components
5. Token/cost panel shows "Collecting data" placeholder when `hasTokenData` is false
6. Use PDI brand colors from `SOURCE_COLORS`, `STATUS_COLORS`, `FEEDBACK_COLORS`
7. Include a responsive header with page title and time range selector

Chart implementations:
- Row 1 left: `<BarChart>` with `<Bar>` per source, stacked
- Row 1 right: `<PieChart>` with source breakdown
- Row 2 left: `<BarChart>` stacked with completed/failed
- Row 2 right: `<PieChart>` with feedback stats
- Row 3 left: `<LineChart>` with avg duration trend
- Row 3 right: `<BarChart layout="vertical">` with top 15 tools
- Row 4 left: `<BarChart>` with project comparison
- Row 4 right: `<LineChart>` with token costs (or placeholder)

Each panel wrapped in a white card with title, matching the existing PDI design patterns (rounded-xl, border-pdi-cool-gray, shadow-sm).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Analytics.tsx
git commit -s --no-verify -m "feat: add Analytics page with 8 Recharts panels"
```

---

### Task 7: Wire up navigation and routing

**Files:**
- Modify: `frontend/src/App.tsx:15,59-67`
- Modify: `frontend/src/components/Layout.tsx:21-45`
- Modify: `frontend/src/components/InvestigationHistory.tsx` (import StatsCards)

- [ ] **Step 1: Add 'analytics' to Page type**

In `frontend/src/App.tsx`, update the Page type:

```typescript
export type Page = 'chat' | 'investigate' | 'history' | 'analytics' | 'integrations' | 'instances' | 'settings' | 'projects' | 'docs'
```

Add import:
```typescript
import Analytics from './components/Analytics'
```

Add the page render inside the Layout children:
```typescript
        {page === 'analytics' && <Analytics />}
```

- [ ] **Step 2: Add Analytics to sidebar navigation**

In `frontend/src/components/Layout.tsx`, add to the Workspace section's items array, after `history`:

```typescript
      { page: 'analytics', label: 'Analytics', icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z' },
```

- [ ] **Step 3: Add StatsCards to InvestigationHistory page**

In `frontend/src/components/InvestigationHistory.tsx`:

Add import at top:
```typescript
import StatsCards from './StatsCards'
```

Add `<StatsCards investigations={investigations} />` above the filter bar, inside the main content area. This should be placed after the page header and before the existing filter/list section.

- [ ] **Step 4: Verify TypeScript compiles and build succeeds**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/components/InvestigationHistory.tsx
git commit -s --no-verify -m "feat: wire up Analytics page in navigation and add StatsCards to History"
```

---

### Task 8: Build, deploy, and verify

**Files:** None (deployment task)

- [ ] **Step 1: Build Docker image**

```bash
docker build -f infra/Dockerfile.frontend -t 717423812395.dkr.ecr.us-east-1.amazonaws.com/holmesgpt:latest .
```

- [ ] **Step 2: Push to ECR**

```bash
aws ecr get-login-password --region us-east-1 --profile pdi-platform-dev | docker login --username AWS --password-stdin 717423812395.dkr.ecr.us-east-1.amazonaws.com
docker push 717423812395.dkr.ecr.us-east-1.amazonaws.com/holmesgpt:latest
```

- [ ] **Step 3: Restart deployment**

```bash
kubectl rollout restart deployment/holmes-holmes -n holmesgpt
kubectl rollout status deployment/holmes-holmes -n holmesgpt --timeout=120s
```

- [ ] **Step 4: Verify health**

```bash
curl -s https://holmesgpt.dev.platform.pditechnologies.com/healthz
curl -s https://holmesgpt.dev.platform.pditechnologies.com/readyz
```

- [ ] **Step 5: Verify Analytics page loads**

Navigate to https://holmesgpt.dev.platform.pditechnologies.com, log in, click Analytics in sidebar. Verify:
- Time range selector works (24h/7d/30d/90d)
- Charts render with data from existing investigations
- StatsCards show on History page
- Token/cost chart shows "Collecting data" placeholder (no metadata yet)

- [ ] **Step 6: Run a test investigation to verify metadata capture**

Send a chat message via the UI. After it completes, check the investigation detail to verify `metadata` is populated with token counts.
