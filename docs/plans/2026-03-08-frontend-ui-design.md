# HolmesGPT Frontend UI Design

## Overview

Build a React SPA frontend for HolmesGPT that provides a chat interface for ad-hoc cluster questions and a structured investigation view for alert analysis. The frontend is embedded in the Holmes container and served by FastAPI alongside the existing REST API. Full PDI Technologies branding applied.

## Architecture

```
Browser -> ALB (HTTPS) -> FastAPI (Holmes Pod)
                            |
                    /api/*  -> existing REST API (no auth)
                    /auth/* -> login/logout endpoints
                    /*      -> React SPA static files (auth required)
```

- React app built during `docker build`, output at `/app/static/`
- FastAPI serves static files with fallback to `index.html` for client-side routing
- Basic auth: session cookie validated by FastAPI middleware on UI routes
- Credentials from env vars `HOLMES_UI_USERNAME` / `HOLMES_UI_PASSWORD` (Secrets Manager)
- API routes remain unauthenticated for programmatic access

## UI Layout

Fixed sidebar (left) + main content area.

### Pages

1. **Chat** (default) - Conversational Q&A interface
   - Message input at bottom, markdown-rendered responses
   - Streaming via `POST /api/chat` with `stream: true`
   - Collapsible tool call cards showing what Holmes investigated
   - Session-only conversation history

2. **Investigations** - Structured alert analysis
   - Form: title, description, source (AlertManager/PagerDuty/Jira/Manual)
   - Results as structured card: summary, root cause, recommendations
   - Session-only history of past investigations

3. **Settings** - Minimal config view
   - Current model name (`GET /api/model`)
   - Health/readiness status indicators

### Sidebar

- PDI logo at top
- Nav: Chat, Investigations, Settings
- "HolmesGPT" title

## PDI Branding

| Element | Value |
|---------|-------|
| Primary | PDI Indigo `#07003d` |
| Accent | PDI Sky `#29b5e8` |
| Font | DM Sans (Google Fonts) |
| Sidebar | Indigo background, white text, Sky active states |
| Buttons | Sky background, Indigo text |
| Status | Grass `#029f50` (healthy), Orange `#ff5100` (error) |

## Tech Stack

- Vite + React 18 + TypeScript
- Tailwind CSS with PDI brand tokens
- react-markdown + remark-gfm for LLM response rendering
- react-syntax-highlighter for code blocks

## Project Structure

```
frontend/
  package.json
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx
    components/
      Layout.tsx          # Sidebar + main content shell
      Chat.tsx            # Chat page
      MessageBubble.tsx   # Single message with markdown
      ToolCallCard.tsx    # Collapsible tool call display
      Investigate.tsx     # Investigation form + results
      Settings.tsx        # Model info, health status
      LoginPage.tsx       # Basic auth login form
    hooks/
      useChat.ts          # Chat API + streaming
      useInvestigate.ts   # Investigation API
    lib/
      api.ts              # Fetch wrapper
    styles/
      globals.css         # Tailwind imports + PDI tokens
```

## Deployment

Multi-stage Dockerfile:
1. Node stage: `npm ci && npm run build` -> produces `dist/`
2. Python stage: copies `dist/` to `/app/static/`

FastAPI changes:
- Mount `StaticFiles` at `/` serving `/app/static/`
- Add `/auth/login` and `/auth/logout` endpoints
- Session cookie middleware for UI routes

Terraform changes:
- Add `HOLMES_UI_USERNAME` and `HOLMES_UI_PASSWORD` to Secrets Manager
- Pass as env vars to Holmes pod

## Decisions

- **No SSR** - SPA is sufficient for an internal tool
- **No state management library** - React state + hooks adequate for session-only data
- **No persistent history** - Conversations and investigations are session-only (YAGNI)
- **API routes unauthenticated** - Preserves existing programmatic integrations
