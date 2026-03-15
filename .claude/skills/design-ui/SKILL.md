# Skill: design-ui

Design and build features for the HolmesGPT custom React frontend.

## Frontend Architecture

**Stack**: React 18 + TypeScript + Tailwind CSS + Vite
**Location**: `infra/frontend/src/`
**Build**: `infra/Dockerfile.frontend` (Node build → served by FastAPI)
**Dev server**: `cd infra/frontend && npm run dev` (proxies `/api/*` to backend on port 5000)

### File Structure

```
infra/frontend/src/
├── App.tsx                    # Root: auth check, page routing (chat/investigate/integrations/settings/projects)
├── main.tsx                   # React entry point
├── lib/
│   └── api.ts                 # All API calls (fetch wrapper, typed interfaces)
├── hooks/
│   ├── useChat.ts             # Chat state: messages, sendMessage, clearMessages, projectId scoping
│   ├── useInvestigate.ts      # Investigation state: submit, results, history
│   └── useProject.ts          # Project selection: loads /api/projects, persists to localStorage
└── components/
    ├── Layout.tsx             # Sidebar nav (pdi-indigo bg), project selector dropdown, main content area
    ├── LoginPage.tsx          # Session cookie login form
    ├── Chat.tsx               # Free-form chat with Holmes (accepts projectId prop)
    ├── Investigate.tsx        # Structured alert investigation form + results
    ├── Integrations.tsx       # Toolset/MCP status grid with toggle/config
    ├── Settings.tsx           # Model info + health checks
    ├── Projects.tsx           # Project CRUD: list cards, create/edit modal with instance editor
    ├── MessageBubble.tsx      # Chat bubble with ReactMarkdown + syntax highlighting
    └── ToolCallCard.tsx       # Collapsible tool call result (dark code block)
```

### Pages

| Page | Route | Purpose |
|---|---|---|
| Chat | `chat` | Free-form Q&A with Holmes, conversation history, scoped to selected project |
| Investigations | `investigate` | Submit alerts for root cause analysis |
| Integrations | `integrations` | View/toggle/configure toolsets and MCP servers |
| Settings | `settings` | Model info, health/readiness status |
| Projects | `projects` | Create/edit/delete projects; group integration instances per team/environment |

---

## PDI Design System

### Color Palette

```typescript
// tailwind.config.ts — all PDI colors
pdi: {
  indigo:     '#07003d',  // Sidebar background, primary brand
  sky:        '#29b5e8',  // Primary action, links, active states
  orange:     '#ff5100',  // Errors, critical alerts, destructive actions
  sun:        '#ffb71b',  // Warnings, loading states
  grass:      '#029f50',  // Success, healthy status, complete
  plum:       '#a1007d',  // Secondary accent (use sparingly)
  ocean:      '#1226aa',  // Secondary blue (use sparingly)
  'cool-gray':'#d6d8d6',  // Borders, dividers, input borders
  slate:      '#8e9c9c',  // Secondary text, placeholders, labels
  granite:    '#323e48',  // Primary text, headings
}
```

**Semantic usage**:
- `text-pdi-granite` — all body text and headings
- `text-pdi-slate` — secondary/helper text, timestamps
- `border-pdi-cool-gray` — all input and card borders
- `bg-pdi-indigo` — sidebar only
- `bg-pdi-sky` — primary buttons, active nav items
- `text-pdi-grass` — success/healthy indicators
- `text-pdi-orange` — error/failed indicators
- `text-pdi-sun` — warning/loading indicators

### Typography

Font: **DM Sans** (loaded via Google Fonts in `index.html`)

```
text-lg font-bold text-pdi-granite    → Page headings (h2)
text-sm font-semibold text-pdi-granite → Card headings (h3)
text-xs font-medium text-pdi-granite  → Form labels
text-sm text-pdi-granite              → Body text
text-xs text-pdi-slate                → Helper text, timestamps
text-xs font-mono                     → Code, tool names, metrics
```

### Component Patterns

**Cards**:
```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
  <h3 className="text-sm font-semibold text-pdi-granite mb-3">Title</h3>
  {/* content */}
</div>
```

**Primary button**:
```tsx
<button className="px-5 py-2 bg-pdi-sky text-white rounded-lg font-medium text-sm hover:bg-pdi-sky/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
  Action
</button>
```

**Secondary/ghost button**:
```tsx
<button className="text-xs text-pdi-slate hover:text-pdi-granite px-3 py-1.5 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors">
  Action
</button>
```

**Text input**:
```tsx
<input className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent" />
```

**Status badge**:
```tsx
// Success
<span className="inline-flex items-center gap-1.5 text-xs text-pdi-grass font-medium">
  <span className="w-2 h-2 bg-pdi-grass rounded-full" />
  Healthy
</span>

// Error
<span className="inline-flex items-center gap-1.5 text-xs text-pdi-orange font-medium">
  <span className="w-2 h-2 bg-pdi-orange rounded-full" />
  Failed
</span>

// Loading
<span className="inline-flex items-center gap-1.5 text-xs text-pdi-sun font-medium">
  <span className="w-2 h-2 bg-pdi-sun rounded-full animate-pulse" />
  Loading
</span>
```

**Loading dots** (used during Holmes investigation):
```tsx
<div className="flex gap-1">
  <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
  <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
  <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
</div>
```

**Empty state**:
```tsx
<div className="flex flex-col items-center justify-center h-full text-center">
  <div className="w-16 h-16 rounded-2xl bg-pdi-sky/10 flex items-center justify-center mb-4">
    <svg className="w-8 h-8 text-pdi-sky" .../>
  </div>
  <h3 className="text-pdi-granite font-semibold text-lg mb-1">Title</h3>
  <p className="text-pdi-slate text-sm max-w-md">Description</p>
</div>
```

**Page header** (consistent across all pages):
```tsx
<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
  <div>
    <h2 className="text-lg font-bold text-pdi-granite">Page Title</h2>
    <p className="text-xs text-pdi-slate">Subtitle</p>
  </div>
  {/* optional right-side action */}
</div>
```

---

## API Integration

### Non-streaming (current pattern)

```typescript
// lib/api.ts — add new endpoint
myEndpoint(data: MyRequest): Promise<MyResponse> {
  return request('/api/my-endpoint', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},
```

### SSE Streaming (for real-time tool call visibility)

The backend supports SSE streaming on `/api/chat`. The current `useChat.ts` uses non-streaming. To add streaming with live tool call display:

```typescript
// hooks/useChatStream.ts
import { useState, useRef, useCallback } from 'react'

interface StreamEvent {
  type: 'start_tool_calling' | 'tool_calling_result' | 'ai_message' | 'ai_answer_end' | 'error'
  tool_name?: string
  description?: string
  result?: string
  content?: string
  analysis?: string
}

export function useChatStream() {
  const [messages, setMessages] = useState<Message[]>([])
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setActiveToolCalls([])

    // Add user message immediately
    const userMsg = { id: crypto.randomUUID(), role: 'user' as const, content: text }
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '', loading: true }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ask: text, stream: true }),
        signal: ctrl.signal,
      })

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // Parse SSE lines
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7).trim()
            // next line is data:
            continue
          }
          if (line.startsWith('data: ')) {
            try {
              const data: StreamEvent = JSON.parse(line.slice(6))
              if (data.type === 'start_tool_calling') {
                setActiveToolCalls(prev => [...prev, {
                  tool_name: data.tool_name!,
                  description: data.description ?? '',
                  result: '',
                  status: 'running',
                }])
              } else if (data.type === 'tool_calling_result') {
                setActiveToolCalls(prev => prev.map(tc =>
                  tc.tool_name === data.tool_name
                    ? { ...tc, result: data.result ?? '', status: 'done' }
                    : tc
                ))
              } else if (data.type === 'ai_message') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + (data.content ?? '') }
                    : m
                ))
              } else if (data.type === 'ai_answer_end') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: data.analysis ?? m.content, loading: false }
                    : m
                ))
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } finally {
      setLoading(false)
      setActiveToolCalls([])
    }
  }, [])

  return { messages, activeToolCalls, loading, sendMessage }
}
```

---

## AWS Incident Triage UI — Planned Features

These features should be added to make the UI effective for AWS incident triage:

### 1. Alert Dashboard (new page: `alerts`)

A dedicated page showing active CloudWatch alarms and recent incidents.

```
┌─────────────────────────────────────────────────────────┐
│ Active Alerts                              [Refresh]    │
├─────────────────────────────────────────────────────────┤
│ 🔴 CRITICAL  PaymentServiceErrorRate       2m ago       │
│              ECS service payment-service               │
│              [Investigate →]                           │
├─────────────────────────────────────────────────────────┤
│ 🟡 WARNING   RDSConnectionCount            15m ago      │
│              db-prod-checkout              [Investigate →]│
├─────────────────────────────────────────────────────────┤
│ 🟢 OK        OrderProcessorLambdaErrors    resolved     │
└─────────────────────────────────────────────────────────┘
```

**Implementation**:
- Add `GET /api/alerts` backend endpoint (queries CloudWatch via AWS MCP)
- Or: pre-populate Investigate form when user clicks "Investigate →"
- Severity colors: `pdi-orange` (critical), `pdi-sun` (warning), `pdi-grass` (ok)

### 2. Live Tool Call Feed (enhance Chat/Investigate)

Show tool calls in real-time as Holmes investigates, not just after completion.

```tsx
// LiveToolFeed component — shows during active investigation
function LiveToolFeed({ toolCalls }: { toolCalls: ActiveToolCall[] }) {
  return (
    <div className="border border-pdi-cool-gray rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-pdi-indigo/5 border-b border-pdi-cool-gray">
        <span className="text-xs font-medium text-pdi-slate">Investigation steps</span>
      </div>
      <div className="divide-y divide-pdi-cool-gray">
        {toolCalls.map((tc, i) => (
          <div key={i} className="px-3 py-2 flex items-center gap-2">
            {tc.status === 'running' ? (
              <span className="w-2 h-2 bg-pdi-sky rounded-full animate-pulse shrink-0" />
            ) : (
              <span className="w-2 h-2 bg-pdi-grass rounded-full shrink-0" />
            )}
            <span className="text-xs font-mono text-pdi-granite">{tc.tool_name}</span>
            <span className="text-xs text-pdi-slate truncate">{tc.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### 3. Incident Timeline (enhance Investigate results)

After investigation completes, show a structured timeline of what Holmes found.

```tsx
// IncidentTimeline — renders structured findings
function IncidentTimeline({ analysis }: { analysis: string }) {
  // Parse markdown sections from Holmes response
  // Render as visual timeline with icons
  return (
    <div className="space-y-3">
      {/* Root Cause */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-pdi-orange/10 flex items-center justify-center shrink-0">
          <span className="text-pdi-orange text-xs font-bold">!</span>
        </div>
        <div>
          <p className="text-xs font-medium text-pdi-granite">Root Cause</p>
          <p className="text-sm text-pdi-slate mt-0.5">{rootCause}</p>
        </div>
      </div>
      {/* Immediate Actions */}
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-pdi-sky/10 flex items-center justify-center shrink-0">
          <span className="text-pdi-sky text-xs font-bold">→</span>
        </div>
        <div>
          <p className="text-xs font-medium text-pdi-granite">Immediate Actions</p>
          {/* list items */}
        </div>
      </div>
    </div>
  )
}
```

### 4. Severity Badge Component

Reusable severity indicator for alerts:

```tsx
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'ok'

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-pdi-orange/10 text-pdi-orange border-pdi-orange/20',
  high:     'bg-pdi-orange/10 text-pdi-orange border-pdi-orange/20',
  medium:   'bg-pdi-sun/10 text-pdi-sun border-pdi-sun/20',
  low:      'bg-pdi-sky/10 text-pdi-sky border-pdi-sky/20',
  ok:       'bg-pdi-grass/10 text-pdi-grass border-pdi-grass/20',
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${SEVERITY_STYLES[severity]}`}>
      {severity.toUpperCase()}
    </span>
  )
}
```

### 5. AWS Context Panel (enhance Investigate form)

Add optional AWS context fields to the investigation form:

```tsx
// Additional fields for AWS incident context
const [awsContext, setAwsContext] = useState({
  service: '',      // ECS service name, Lambda function, etc.
  cluster: '',      // ECS cluster or EKS cluster
  region: 'us-east-1',
  alarmName: '',    // CloudWatch alarm name
  alarmTime: '',    // ISO timestamp of alarm
})

// Builds a rich investigation prompt:
const buildPrompt = () => {
  const parts = [description]
  if (awsContext.alarmName) parts.push(`CloudWatch alarm: ${awsContext.alarmName}`)
  if (awsContext.service) parts.push(`Affected service: ${awsContext.service}`)
  if (awsContext.alarmTime) parts.push(`Alarm fired at: ${awsContext.alarmTime}`)
  return parts.join('. ')
}
```

### 6. Structured Output Display

When using `response_format` JSON schema, render the structured incident report:

```tsx
interface IncidentReport {
  root_cause: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  affected_services: string[]
  immediate_actions: string[]
  long_term_fixes: string[]
  confidence: 'high' | 'medium' | 'low'
}

function IncidentReportCard({ report }: { report: IncidentReport }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-sm text-pdi-granite">Incident Report</h3>
        <div className="flex items-center gap-2">
          <SeverityBadge severity={report.severity} />
          <span className="text-xs text-pdi-slate">Confidence: {report.confidence}</span>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div>
          <p className="text-xs font-medium text-pdi-slate uppercase tracking-wide mb-1">Root Cause</p>
          <p className="text-sm text-pdi-granite">{report.root_cause}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-pdi-slate uppercase tracking-wide mb-2">Immediate Actions</p>
          <ul className="space-y-1">
            {report.immediate_actions.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-pdi-granite">
                <span className="text-pdi-sky mt-0.5">→</span>
                {action}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium text-pdi-slate uppercase tracking-wide mb-2">Long-term Fixes</p>
          <ul className="space-y-1">
            {report.long_term_fixes.map((fix, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-pdi-granite">
                <span className="text-pdi-grass mt-0.5">✓</span>
                {fix}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
```

---

## Adding a New Page

1. Add the page type to `App.tsx`:
   ```typescript
   export type Page = 'chat' | 'investigate' | 'integrations' | 'settings' | 'projects' | 'newpage'
   ```

2. Add nav item to `Layout.tsx`:
   ```typescript
   { page: 'newpage', label: 'New Page', icon: 'M12 9v3.75m-9.303 3.376c...' },
   ```

3. Create `infra/frontend/src/components/NewPage.tsx`

4. Add the route in `App.tsx`:
   ```tsx
   {page === 'newpage' && <NewPage />}
   ```

5. Add any new API methods to `lib/api.ts`

6. Create a hook in `hooks/useNewPage.ts` following the `useProject.ts` pattern

---

## Projects Feature Reference

The Projects feature (added 2026-03) lets users group integration instances per team/environment and scope chat to only those tools.

### Key files

| File | Purpose |
|---|---|
| `infra/frontend/src/components/Projects.tsx` | CRUD UI: list cards, create/edit modal, `InstanceEditor` component |
| `infra/frontend/src/hooks/useProject.ts` | Loads `/api/projects`, persists `selectedProjectId` to `localStorage` |
| `infra/frontend/src/components/Layout.tsx` | Project selector `<select>` between logo and nav |
| `infra/frontend/src/components/Chat.tsx` | Accepts `projectId` prop, passes to `useChat` |
| `infra/frontend/src/hooks/useChat.ts` | Sends `project_id` in request body; clears history on project switch |
| `infra/frontend/src/lib/api.ts` | `ToolsetInstance`, `Project`, `ProjectsResponse` types; CRUD methods |
| `infra/frontend/projects.py` | Backend: DynamoDB-backed `ProjectsStore`, `build_project_tool_executor` |

### ToolsetInstance model

```typescript
interface ToolsetInstance {
  type: string          // 'grafana/dashboards' | 'aws_api' | 'ado' | 'atlassian' | 'salesforce' | ...
  name: string          // unique instance name within the project
  secret_arn: string | null   // Secrets Manager ARN for per-project credentials
  mcp_url?: string | null     // MCP server URL override (null = use global)
  aws_accounts?: string[] | null  // restrict AWS toolset to these account profile names
}
```

### Instance editor behaviour per type

| Type | Fields shown | Backend behaviour |
|---|---|---|
| `grafana/*`, `prometheus/metrics` | Secret ARN | Fetches creds from Secrets Manager, instantiates Python toolset |
| `ado`, `atlassian`, `salesforce` | Secret ARN (API key), MCP URL override | Instantiates `RemoteMCPToolset` with per-project API key |
| `aws_api` | AWS account checkboxes (from `/api/aws/accounts`) | Copies global AWS toolset, overrides `llm_instructions` to restrict `--profile` values |
| Any (no secret_arn) | — | Reuses global toolset directly |

### useProject hook

```typescript
const { projects, selectedProjectId, selectedProject, selectProject, reloadProjects, loading } = useProject()
```

- Loads from `/api/projects` on mount
- Persists `selectedProjectId` to `localStorage` key `holmesgpt_selected_project`
- `selectProject(id | null)` — null means "All integrations" (no scoping)

### Conversation history scoping

`useChat` clears `serverHistoryRef` when `projectId` changes so the LLM doesn't carry context from a different project's conversation.

---

## Development Workflow

```bash
# Start frontend dev server (hot reload, proxies to backend)
cd infra/frontend
npm install
npm run dev
# → http://localhost:5173

# Backend must be running for API calls to work
cd /path/to/holmesgpt-pdi
poetry run python -m holmes.main serve --port 5000

# Build for production (output goes to infra/frontend/dist/)
cd infra/frontend
npm run build

# Type check
npm run tsc --noEmit
```

The Vite dev server proxies `/api/*`, `/auth/*`, `/healthz`, `/readyz` to `http://localhost:5000` (configured in `vite.config.ts`).

---

## Key Design Principles

1. **No external UI component library** — use Tailwind utility classes directly
2. **Inline SVG icons** — no icon library, use Heroicons SVG paths inline
3. **Consistent page structure** — every page has the same header pattern (border-b, px-6 py-4)
4. **White cards on gray background** — main content area uses `bg-gray-50`, cards use `bg-white`
5. **pdi-sky for all interactive elements** — buttons, focus rings, active states
6. **Semantic status colors** — grass=ok, orange=error, sun=warning (never use raw red/green)
7. **Font mono for technical data** — tool names, metrics, timestamps, model names
