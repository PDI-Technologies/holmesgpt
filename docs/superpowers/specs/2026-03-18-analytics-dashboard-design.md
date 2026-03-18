# HolmesGPT Analytics Dashboard Design

**Date:** 2026-03-18
**Status:** Approved by user
**Approach:** Client-side aggregation with Recharts, backend metadata capture

---

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Audience | Both engineering + leadership | Summary cards for leadership, drill-downs for engineers |
| Data approach | Hybrid — ship with existing data, add metadata field for tokens/costs | Fast to ship while accumulating richer data |
| Dashboard placement | Both — stats on History page + dedicated Analytics page | Stats where users already go + deep-dive page |
| Time range | Selectable (24h/7d/30d/90d), default 7d | Flexible for different audiences |
| Charts | All 8 chart types | Full coverage |
| Chart library | Recharts | Best trade-off of speed, quality, bundle size |
| Aggregation | Client-side now, backend later | Sufficient for <10K investigations |

---

## 1. Data Layer

### Investigation Model Change

Add optional `metadata` dict to `Investigation` in `projects.py`:

```python
class Investigation(BaseModel):
    # ... existing fields ...
    metadata: dict = {}  # tokens, cost, model, duration_ms
```

Populated at investigation completion:
```python
metadata = {
    "model": "anthropic/claude-sonnet-4-5-20250929",
    "prompt_tokens": 12340,
    "completion_tokens": 2100,
    "total_tokens": 14440,
    "duration_ms": 8500,
}
```

No DynamoDB schema change — the `data` column already stores full model JSON.

### Derived Metrics (computed client-side)

- Duration: `finished_at - started_at`
- Tool call count: `len(tool_calls)`
- Tool names: extracted from `tool_calls[].tool_name`
- Success rate: `status == "completed"` vs total
- Feedback rate: `feedback != null` vs total

---

## 2. API Changes

### Existing Endpoint Enhancement

Add `start_date` and `end_date` query params to `GET /api/investigations`:

```
GET /api/investigations?start_date=2026-03-11&end_date=2026-03-18&project_id=optional
```

Update `InvestigationStore.list()` to add date range filter on `started_at` attribute.

### Metadata Capture Points

1. **Streaming chat** (`server.py` -> `_investigation_tracking_stream`): Extract token usage from `ai_answer_end` event metadata.
2. **Non-streaming chat** (`server.py` -> `messages_call`): Extract from `llm_call.metadata`.
3. **Webhook investigations** (`server_frontend.py`): Extract from `ai.messages_call()` return metadata.

---

## 3. Frontend Architecture

### New Dependencies

- `recharts` — React charting library (~45KB gzipped)

### New Components

**`StatsCards.tsx`** — Reusable summary bar (used on History + Analytics pages)
- Props: `investigations: Investigation[]`
- 4 cards: Total Investigations | Success Rate | Avg Duration | Active Sources
- Computes stats client-side from investigation array

**`Analytics.tsx`** — New top-level page at `/analytics`
- Time range selector (24h / 7d / 30d / 90d) at top
- Optional project filter dropdown
- 8 chart panels in responsive 2-column grid

### Chart Layout

| Row | Left | Right |
|-----|------|-------|
| 1 | Investigation volume (BarChart, by source) | Source breakdown (PieChart) |
| 2 | Success/failure rate (stacked BarChart) | Feedback stats (PieChart) |
| 3 | Avg duration trend (LineChart) | Tool usage ranking (horizontal BarChart) |
| 4 | Project comparison (BarChart) | Token/cost tracking (LineChart or placeholder) |

### History Page Enhancement

Import `StatsCards` at top of existing `InvestigationHistory.tsx`, above the filter bar.

### Data Flow

```
Analytics.tsx
  -> GET /api/investigations?start_date=X&end_date=Y
  -> useAnalytics(investigations) hook
     -> computeVolumeBySource(investigations, timeRange)
     -> computeSuccessRate(investigations, timeRange)
     -> computeAvgDuration(investigations, timeRange)
     -> computeToolRanking(investigations)
     -> computeSourceBreakdown(investigations)
     -> computeProjectComparison(investigations)
     -> computeFeedbackStats(investigations)
     -> computeTokenCosts(investigations)  // graceful degradation
  -> Chart components receive pre-computed data
```

### Color Palette (PDI brand)

- UI source: `pdi-sky` (#0EA5E9)
- PagerDuty: `pdi-grass` (#22C55E)
- ADO: `pdi-ocean` (#0284C7)
- Salesforce: `pdi-plum` (#A855F7)
- CLI: `pdi-slate` (#64748B)
- Webhook: `pdi-sun` (#F59E0B)
- Completed: `pdi-grass`
- Failed: `pdi-orange` (#F97316)
- Helpful: `pdi-grass`
- Not helpful: `pdi-orange`
- Unrated: `pdi-cool-gray`

---

## 4. Token/Cost Tracking

### Metadata Capture

At investigation completion, extract from LLM response:
```python
investigation.metadata = {
    "model": llm.model,
    "prompt_tokens": usage.get("prompt_tokens", 0),
    "completion_tokens": usage.get("completion_tokens", 0),
    "total_tokens": usage.get("total_tokens", 0),
    "duration_ms": int((finished - started).total_seconds() * 1000),
}
```

### Client-Side Cost Calculation

`useAnalytics` hook includes a model-to-price lookup:
```typescript
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'anthropic/claude-sonnet-4-5-20250929': { input: 3.0, output: 15.0 }, // per 1M tokens
  // add more as needed
}
```

Cost = `(prompt_tokens * input_price + completion_tokens * output_price) / 1_000_000`

### Graceful Degradation

Token/Cost chart shows "Collecting data — metrics available for new investigations" until at least 5 investigations have metadata. Older investigations without metadata are excluded from token charts but count in all other charts.

---

## 5. Navigation

Add "Analytics" to sidebar in `Layout.tsx`:
- Icon: chart/bar-chart SVG
- Position: after "History", before "Integrations"
- Route: `/analytics`

Add route in `App.tsx`: `<Route path="/analytics" element={<Analytics />} />`

---

## 6. Testing

- Unit tests for `useAnalytics` hook aggregation functions
- Verify StatsCards renders correctly with 0 investigations, 1 investigation, and many
- Verify time range filtering works correctly
- Verify graceful degradation when metadata is missing
- Visual check that charts render with PDI brand colors
