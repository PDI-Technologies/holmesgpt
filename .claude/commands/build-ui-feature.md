Add a new feature or page to the HolmesGPT custom React frontend following PDI design patterns.

$ARGUMENTS

## Step 1: Understand the Request

Parse $ARGUMENTS to determine:
- What feature/page/component to build
- Which existing page it belongs to (or if it's a new page)
- What API endpoints it needs

## Step 2: Read Relevant Existing Code

Before writing any code, read the files most relevant to your change:

```bash
# For a new page: read App.tsx, Layout.tsx, and the most similar existing page
# For a component: read the component it will be used in
# For API changes: read lib/api.ts
```

Key files:
- `frontend/src/App.tsx` — page routing
- `frontend/src/components/Layout.tsx` — sidebar nav
- `frontend/src/lib/api.ts` — all API calls and TypeScript interfaces
- `frontend/src/hooks/useChat.ts` — hook pattern reference
- `frontend/tailwind.config.ts` — PDI color palette

## Step 3: Follow the Design System

**PDI Color Palette** (from `tailwind.config.ts`):
```
pdi-indigo:    #07003d  → sidebar background only
pdi-sky:       #29b5e8  → primary buttons, active states, focus rings
pdi-orange:    #ff5100  → errors, critical alerts
pdi-sun:       #ffb71b  → warnings, loading
pdi-grass:     #029f50  → success, healthy
pdi-cool-gray: #d6d8d6  → borders, dividers
pdi-slate:     #8e9c9c  → secondary text
pdi-granite:   #323e48  → primary text
```

**Required patterns** (copy these exactly):

Page header:
```tsx
<div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
  <div>
    <h2 className="text-lg font-bold text-pdi-granite">Title</h2>
    <p className="text-xs text-pdi-slate">Subtitle</p>
  </div>
</div>
```

Card:
```tsx
<div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
  <h3 className="text-sm font-semibold text-pdi-granite mb-3">Card Title</h3>
</div>
```

Primary button:
```tsx
<button className="px-5 py-2 bg-pdi-sky text-white rounded-lg font-medium text-sm hover:bg-pdi-sky/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
```

Input:
```tsx
<input className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent" />
```

Status badge:
```tsx
// success: text-pdi-grass + bg-pdi-grass rounded-full dot
// error: text-pdi-orange + bg-pdi-orange rounded-full dot
// loading: text-pdi-sun + bg-pdi-sun animate-pulse dot
```

Empty state:
```tsx
<div className="flex flex-col items-center justify-center h-full text-center">
  <div className="w-16 h-16 rounded-2xl bg-pdi-sky/10 flex items-center justify-center mb-4">
    <svg className="w-8 h-8 text-pdi-sky" .../>
  </div>
  <h3 className="text-pdi-granite font-semibold text-lg mb-1">No items yet</h3>
  <p className="text-pdi-slate text-sm max-w-md">Description</p>
</div>
```

## Step 4: Implement

### Adding a new page

1. Add to `App.tsx` type: `export type Page = 'chat' | 'investigate' | 'integrations' | 'projects' | 'settings' | 'newpage'`
2. Add nav item to `Layout.tsx` navItems array with SVG path from Heroicons
3. Create `frontend/src/components/NewPage.tsx`
4. Add route in `App.tsx`: `{page === 'newpage' && <NewPage />}`
5. Add API methods to `lib/api.ts` if needed
6. Create hook in `hooks/useNewPage.ts` if state management is needed

Existing pages for reference: `chat`, `investigate`, `integrations`, `projects` (see `Projects.tsx` + `useProject.ts`).

### Adding a component

Create `frontend/src/components/MyComponent.tsx`:
```tsx
interface MyComponentProps {
  // typed props
}

export default function MyComponent({ ... }: MyComponentProps) {
  return (
    // use PDI design patterns
  )
}
```

### Adding an API endpoint

In `lib/api.ts`:
```typescript
// 1. Add TypeScript interfaces
export interface MyRequest { ... }
export interface MyResponse { ... }

// 2. Add to api object
myEndpoint(data: MyRequest): Promise<MyResponse> {
  return request('/api/my-endpoint', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},
```

### Adding SSE streaming

For real-time tool call visibility during investigations:
```typescript
async myStreamEndpoint(
  data: MyRequest,
  onToolCall: (toolName: string, description: string) => void,
  onToolResult: (toolName: string, result: string) => void,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ ...data, stream: true }),
    signal,
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalAnalysis = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const data = JSON.parse(line.slice(6))
        if (data.type === 'start_tool_calling') onToolCall(data.tool_name, data.description ?? '')
        else if (data.type === 'tool_calling_result') onToolResult(data.tool_name, data.result ?? '')
        else if (data.type === 'ai_message') onChunk(data.content ?? '')
        else if (data.type === 'ai_answer_end') finalAnalysis = data.analysis ?? ''
      } catch { /* ignore */ }
    }
  }
  return finalAnalysis
}
```

## Step 5: No External Libraries

Do NOT add new npm packages for:
- UI components (no shadcn, no MUI, no Ant Design)
- Icons (use inline SVG Heroicons paths)
- Charts (use CSS/SVG directly or a minimal library already in package.json)
- Date formatting (use `toLocaleString()`)

Check `frontend/package.json` for what's already available before adding anything.

## Step 6: TypeScript

- All props must be typed with interfaces
- No `any` types
- Use `unknown` for truly unknown data, then narrow with type guards
- Async functions must handle errors with try/catch

## Step 7: Test Manually

```bash
cd frontend
npm run dev
# Open http://localhost:5173
# Navigate to the new page/feature
# Test all states: loading, empty, populated, error
```

## Step 8: Build Check

```bash
cd frontend
npm run build
# Must complete with no TypeScript errors
```
