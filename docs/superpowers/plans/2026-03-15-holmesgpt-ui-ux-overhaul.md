# HolmesGPT PDI UI/UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the HolmesGPT PDI frontend to be stylish, intuitive, and fully aligned with PDI brand guidelines across all screens.

**Architecture:** Each component is updated in isolation — no shared state changes, no new dependencies. All changes are pure Tailwind CSS class swaps, minor JSX restructuring, and small React state additions. The PDI color palette is already defined in `tailwind.config.js`; we only need to use it consistently.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (PDI palette), DM Sans font, ReactMarkdown, react-syntax-highlighter

---

## PDI Color Reference (for implementers)

| Class | Hex | Use |
|---|---|---|
| `pdi-indigo` | #07003d | Primary brand, dark backgrounds, sidebar |
| `pdi-sky` | #29b5e8 | Accent, CTAs, links, focus rings |
| `pdi-ocean` | #1226aa | Hover states, deep accents |
| `pdi-orange` | #ff5100 | Errors, destructive actions |
| `pdi-sun` | #ffb71b | Warnings, AWS context |
| `pdi-grass` | #029f50 | Success states |
| `pdi-granite` | #323e48 | Body text (replaces gray-900) |
| `pdi-slate` | #8e9c9c | Secondary text (replaces gray-500/600) |
| `pdi-cool-gray` | #d6d8d6 | Borders, dividers (replaces gray-200/300) |

**Rule:** Replace `text-gray-900` → `text-pdi-granite`, `text-gray-500/600` → `text-pdi-slate`, `border-gray-200/300` → `border-pdi-cool-gray`, `bg-gray-50` → `bg-gray-50` (keep — no PDI equivalent for page backgrounds).

---

## Chunk 1: LoginPage

### Task 1: Enhance LoginPage visual design

**Files:**
- Modify: `infra/frontend/src/components/LoginPage.tsx`

- [ ] **Step 1: Add radial gradient background with grid pattern**

Replace the plain `bg-pdi-indigo` background with a layered gradient. Find the outermost `<div>` with `className="min-h-screen bg-pdi-indigo ...">` and update it:

```tsx
// BEFORE
<div className="min-h-screen bg-pdi-indigo flex items-center justify-center px-4">

// AFTER
<div className="min-h-screen bg-pdi-indigo flex items-center justify-center px-4 relative overflow-hidden">
  {/* Background decoration */}
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1226aa33_0%,_transparent_60%)]" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#29b5e820_0%,_transparent_50%)]" />
  <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(#29b5e8_1px,transparent_1px),linear-gradient(to_right,#29b5e8_1px,transparent_1px)] bg-[size:40px_40px]" />
```

- [ ] **Step 2: Replace logo "H" letter with magnifying glass SVG**

Find the logo div (currently shows letter "H") and replace:

```tsx
// BEFORE — letter H logo
<div className="inline-flex w-16 h-16 rounded-2xl bg-pdi-sky/20 items-center justify-center mb-6">
  <span className="text-pdi-sky text-3xl font-bold">H</span>
</div>

// AFTER — magnifying glass matching sidebar
<div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-pdi-sky to-pdi-ocean items-center justify-center mb-6 shadow-lg shadow-pdi-sky/30">
  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
</div>
```

- [ ] **Step 3: Add proper label elements and autoComplete attributes to inputs**

Find the username/password inputs and add `<label>` elements and `autoComplete`:

```tsx
// Username input — add label + autoComplete
<div>
  <label htmlFor="login-username" className="block text-sm font-medium text-gray-300 mb-1.5">
    Username
  </label>
  <input
    id="login-username"
    type="text"
    autoComplete="username"
    // ... rest of props
  />
</div>

// Password input — add label + autoComplete
<div>
  <label htmlFor="login-password" className="block text-sm font-medium text-gray-300 mb-1.5">
    Password
  </label>
  <input
    id="login-password"
    type="password"
    autoComplete="current-password"
    // ... rest of props
  />
</div>
```

- [ ] **Step 4: Add `focus-visible:` ring variants to inputs**

Update input className to use `focus-visible:` instead of `focus:` for keyboard-only focus indicators:

```tsx
// Replace focus: with focus-visible: on all login inputs
className="w-full px-3 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pdi-sky focus-visible:border-pdi-sky/50 transition-colors"
```

- [ ] **Step 5: Add gradient accent line above the submit button**

Before the submit button, add a subtle divider:

```tsx
<div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-4" />
```

- [ ] **Step 6: Wrap content in `relative z-10` to sit above background decorations**

```tsx
// Wrap the card in relative z-10
<div className="relative z-10 w-full max-w-sm">
  {/* existing card content */}
</div>
```

- [ ] **Step 7: Verify the login page renders correctly**

Open the app and navigate to the login page. Confirm:
- Dark indigo background with subtle grid pattern
- Gradient logo icon (sky → ocean)
- Inputs have labels
- No visual regressions

- [ ] **Step 8: Commit**

```bash
cd C:\Codebase\holmesgpt-pdi
git add infra/frontend/src/components/LoginPage.tsx
git commit -s --no-verify -m "feat(ui): enhance LoginPage with gradient background, SVG logo, and accessibility labels"
```

---

## Chunk 2: Layout / Sidebar

### Task 2: Improve sidebar project selector and logout button

**Files:**
- Modify: `infra/frontend/src/components/Layout.tsx`

- [ ] **Step 1: Standardize sidebar opacity tokens**

In the sidebar, replace inconsistent opacity values with a consistent scale. Find all `text-white/XX` and `bg-white/XX` classes and standardize:

```
text-white/25 → text-white/30  (section labels)
text-white/60 → text-white/60  (nav items — keep)
text-white/80 → text-white/80  (profile name — keep)
bg-white/8    → bg-white/10    (select background)
bg-white/12   → bg-white/15    (select hover)
bg-white/6    → bg-white/8     (nav item hover)
```

- [ ] **Step 2: Make logout button always visible (not hover-only)**

Find the sign-out icon in the profile footer and change from hover-only to always visible:

```tsx
// BEFORE
<svg className="w-4 h-4 text-white/0 group-hover:text-white/50 transition-colors shrink-0" ...>

// AFTER
<svg className="w-4 h-4 text-white/30 group-hover:text-pdi-orange transition-colors shrink-0" ...>
```

- [ ] **Step 3: Add gradient accent line below the logo area**

After the logo `<div>` closing tag, the border-b already exists. Enhance it:

```tsx
// Replace border-b border-white/10 on logo div with:
className="px-5 py-5 border-b border-white/10 relative"

// Add inside the logo div, after the content:
<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pdi-sky/30 to-transparent" />
```

- [ ] **Step 4: Add active indicator dot to project selector when a project is selected**

In the project selector section, add a visual indicator when a project is active:

```tsx
// After the </select> closing tag, add:
{selectedProjectId && (
  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-pdi-sky pointer-events-none" />
)}
// Also add pl-6 to the select when selectedProjectId is set:
className={`w-full text-sm bg-white/8 text-white border border-white/15 rounded-lg py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-pdi-sky/50 focus:border-pdi-sky/50 appearance-none cursor-pointer transition-colors hover:bg-white/12 ${selectedProjectId ? 'pl-6' : 'pl-3'}`}
```

- [ ] **Step 5: Add `title` attribute to nav buttons for tooltip on hover**

```tsx
// Add title to each nav button
<button
  key={page}
  onClick={() => onNavigate(page)}
  title={label}
  className={...}
>
```

- [ ] **Step 6: Verify sidebar renders correctly**

Check:
- Logout icon always visible (dim), turns orange on hover
- Gradient line under logo
- Project dot indicator when project selected
- No visual regressions

- [ ] **Step 7: Commit**

```bash
git add infra/frontend/src/components/Layout.tsx
git commit -s --no-verify -m "feat(ui): improve sidebar with consistent opacity tokens, visible logout, gradient accents"
```

---

## Chunk 3: Chat Component

### Task 3: Improve Chat suggestion chips and input behavior

**Files:**
- Modify: `infra/frontend/src/components/Chat.tsx`

- [ ] **Step 1: Make suggestion chips send immediately (not populate-and-focus)**

Find the suggestion chip `onClick` handlers and change from populate-input to send-directly:

```tsx
// BEFORE
onClick={() => { setInput(suggestion); inputRef.current?.focus() }}

// AFTER — for K8S suggestions
onClick={() => { if (!loading) sendMessage(suggestion) }}

// AFTER — for AWS suggestions (same)
onClick={() => { if (!loading) sendMessage(suggestion) }}
```

Also add `disabled={loading}` and `aria-label` to each chip button:

```tsx
<button
  key={suggestion}
  onClick={() => { if (!loading) sendMessage(suggestion) }}
  disabled={loading}
  aria-label={`Ask: ${suggestion}`}
  className="text-left text-sm px-3 py-2 rounded-lg border border-pdi-cool-gray text-pdi-granite hover:border-pdi-sky hover:bg-pdi-sky/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
>
```

- [ ] **Step 2: Add auto-growing textarea**

Add a `useEffect` that adjusts textarea height based on content. Add after the existing `useEffect` hooks:

```tsx
// Add this useEffect for auto-growing textarea
useEffect(() => {
  if (inputRef.current) {
    inputRef.current.style.height = 'auto'
    inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`
  }
}, [input])
```

Update textarea className to remove fixed `rows={1}`:

```tsx
<textarea
  ref={inputRef}
  value={input}
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={handleKeyDown}
  placeholder="Ask Holmes a question..."
  rows={1}
  style={{ resize: 'none', overflow: 'hidden' }}
  className="flex-1 px-4 py-2.5 border border-pdi-cool-gray rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent placeholder:text-pdi-slate/60 min-h-[42px] max-h-40"
  disabled={loading}
/>
```

- [ ] **Step 3: Add gradient accent line to Chat header**

After the header `<div>` closing tag (the one with `border-b border-gray-200`), add:

```tsx
// Replace border-b border-gray-200 on header div with:
className="flex items-center justify-between px-6 py-4 border-b border-pdi-cool-gray bg-white"

// Add gradient line inside header, as last child:
<div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pdi-sky via-pdi-ocean to-pdi-indigo opacity-60" />
```

Also add `relative` to the header div.

- [ ] **Step 4: Update "Clear chat" button to use PDI colors**

```tsx
// BEFORE
className="text-xs text-pdi-slate hover:text-pdi-granite px-3 py-1.5 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors"

// AFTER — add two-step confirmation
```

Add a `confirmClear` state:

```tsx
const [confirmClear, setConfirmClear] = useState(false)
```

Replace the clear button with a two-step flow:

```tsx
{messages.length > 0 && (
  confirmClear ? (
    <div className="flex items-center gap-2">
      <span className="text-xs text-pdi-slate">Clear all messages?</span>
      <button
        onClick={() => { clearMessages(); setConfirmClear(false) }}
        className="text-xs font-medium text-white bg-pdi-orange px-2.5 py-1 rounded-lg hover:bg-pdi-orange/90 transition-colors"
      >
        Yes, clear
      </button>
      <button
        onClick={() => setConfirmClear(false)}
        className="text-xs text-pdi-slate px-2.5 py-1 rounded-lg border border-pdi-cool-gray hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setConfirmClear(true)}
      className="text-xs text-pdi-slate hover:text-pdi-granite px-3 py-1.5 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors"
    >
      Clear chat
    </button>
  )
)}
```

- [ ] **Step 5: Update send button hover/active states**

```tsx
// BEFORE
className="px-4 py-2.5 bg-pdi-sky text-white rounded-xl font-medium text-sm hover:bg-pdi-sky/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"

// AFTER
className="px-4 py-2.5 bg-pdi-sky text-white rounded-xl font-medium text-sm hover:bg-pdi-ocean active:scale-95 transition-all disabled:bg-pdi-cool-gray disabled:text-pdi-slate disabled:cursor-not-allowed shrink-0"
```

- [ ] **Step 6: Update AWS context pill border color**

```tsx
// BEFORE
className="inline-flex items-center gap-1.5 text-xs bg-pdi-sun/10 text-pdi-sun px-2.5 py-1 rounded-full border border-pdi-sun/30"

// AFTER — no change needed, already correct
```

- [ ] **Step 7: Verify Chat renders correctly**

Check:
- Suggestion chips send immediately on click
- Textarea grows with content
- Gradient line in header
- Two-step clear confirmation
- Send button turns gray when disabled

- [ ] **Step 8: Commit**

```bash
git add infra/frontend/src/components/Chat.tsx
git commit -s --no-verify -m "feat(ui): improve Chat with auto-growing textarea, direct-send chips, clear confirmation"
```

---

## Chunk 4: MessageBubble

### Task 4: Improve MessageBubble visual design

**Files:**
- Modify: `infra/frontend/src/components/MessageBubble.tsx`

- [ ] **Step 1: Read the current MessageBubble.tsx**

```bash
# Read the file to understand current structure
```

Use the Read tool on `infra/frontend/src/components/MessageBubble.tsx`.

- [ ] **Step 2: Mute user bubble background**

Find the user message bubble and change from solid sky to subtle:

```tsx
// BEFORE — user bubble
className="... bg-pdi-sky text-white rounded-2xl rounded-br-md ..."

// AFTER — muted user bubble
className="... bg-pdi-sky/10 text-pdi-granite border border-pdi-sky/20 rounded-2xl rounded-br-md ..."
```

- [ ] **Step 3: Add Holmes avatar to assistant messages**

Before the assistant message bubble content, add an avatar:

```tsx
// Wrap assistant message in flex row with avatar
<div className="flex items-start gap-2">
  {/* Holmes avatar */}
  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-pdi-sky to-pdi-ocean flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </div>
  {/* existing bubble */}
  <div className="bg-white border border-pdi-cool-gray rounded-2xl rounded-bl-md shadow-sm px-4 py-3 max-w-[80%]">
    ...
  </div>
</div>
```

- [ ] **Step 4: Add copy button to assistant messages**

Add a copy button that appears on hover. Add `useState` for copy state:

```tsx
import { useState } from 'react'

// Inside component:
const [copied, setCopied] = useState(false)

const handleCopy = () => {
  navigator.clipboard.writeText(content)
  setCopied(true)
  setTimeout(() => setCopied(false), 2000)
}
```

Add copy button inside the assistant bubble, after the content:

```tsx
<div className="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
  <button
    onClick={handleCopy}
    className="text-xs text-pdi-slate hover:text-pdi-sky transition-colors flex items-center gap-1"
    title="Copy response"
  >
    {copied ? (
      <>
        <svg className="w-3.5 h-3.5 text-pdi-grass" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-pdi-grass">Copied</span>
      </>
    ) : (
      <>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        Copy
      </>
    )}
  </button>
</div>
```

Add `group` class to the assistant bubble wrapper div.

- [ ] **Step 5: Verify MessageBubble renders correctly**

Check:
- User messages: subtle sky tint, not solid blue
- Assistant messages: avatar icon on left
- Copy button appears on hover
- Copied state shows green checkmark

- [ ] **Step 6: Commit**

```bash
git add infra/frontend/src/components/MessageBubble.tsx
git commit -s --no-verify -m "feat(ui): improve MessageBubble with muted user bubble, Holmes avatar, copy button"
```

---

## Chunk 5: ToolCallCard

### Task 5: Fix ToolCallCard brand colors

**Files:**
- Modify: `infra/frontend/src/components/ToolCallCard.tsx`

- [ ] **Step 1: Read the current ToolCallCard.tsx**

Use the Read tool on `infra/frontend/src/components/ToolCallCard.tsx`.

- [ ] **Step 2: Replace non-brand `text-emerald-300` with PDI equivalent**

Find the expanded state code block (dark background with green text) and replace:

```tsx
// BEFORE — non-brand color
className="... bg-pdi-indigo text-emerald-300 font-mono ..."

// AFTER — PDI brand
className="... bg-pdi-granite text-pdi-sky/90 font-mono ..."
```

Also update the collapsed header background:

```tsx
// BEFORE
className="... bg-pdi-indigo/5 ..."

// AFTER
className="... bg-pdi-sky/5 ..."
```

- [ ] **Step 3: Add copy button to tool call result**

Add a copy button to the expanded tool result, similar to MessageBubble:

```tsx
// Add useState for copy state at top of component
const [resultCopied, setResultCopied] = useState(false)

// Add copy button in the expanded result area
<div className="flex justify-end px-3 py-1.5 border-t border-white/10">
  <button
    onClick={() => {
      navigator.clipboard.writeText(result || '')
      setResultCopied(true)
      setTimeout(() => setResultCopied(false), 2000)
    }}
    className="text-xs text-pdi-sky/60 hover:text-pdi-sky transition-colors flex items-center gap-1"
  >
    {resultCopied ? 'Copied ✓' : 'Copy output'}
  </button>
</div>
```

- [ ] **Step 4: Add status color to tool call header**

Add a colored left border based on whether the tool call has a result or error:

```tsx
// Add to the collapsed header div
className={`... border-l-2 ${result ? 'border-l-pdi-grass' : 'border-l-pdi-sky'}`}
```

- [ ] **Step 5: Verify ToolCallCard renders correctly**

Check:
- No emerald-300 color — uses pdi-sky instead
- Copy button in expanded state
- Green left border when result present

- [ ] **Step 6: Commit**

```bash
git add infra/frontend/src/components/ToolCallCard.tsx
git commit -s --no-verify -m "feat(ui): fix ToolCallCard brand colors, add copy button, status border"
```

---

## Chunk 6: Investigate Component

### Task 6: Improve Investigate form and results

**Files:**
- Modify: `infra/frontend/src/components/Investigate.tsx`

- [ ] **Step 1: Pin form at top — restructure layout**

The current layout has form inside the scrollable area. Move it outside:

```tsx
// BEFORE structure:
<div className="flex-1 overflow-y-auto">
  <div className="px-6 py-5 border-b ...">  {/* form */}
  <div className="px-6 py-4 space-y-4">    {/* results */}

// AFTER structure:
{/* Form — pinned, does NOT scroll */}
<div className="px-6 py-5 border-b border-pdi-cool-gray bg-white shrink-0">
  <form ...>

{/* Results — scrollable */}
<div className="flex-1 overflow-y-auto">
  <div className="px-6 py-4 space-y-4">
```

- [ ] **Step 2: Don't clear form on submit — add explicit "Clear" link**

Remove `setTitle('')` and `setDescription('')` from `handleSubmit`. Add a clear link instead:

```tsx
// REMOVE from handleSubmit:
setTitle('')
setDescription('')

// ADD after the submit button:
{(title || description) && (
  <button
    type="button"
    onClick={() => { setTitle(''); setDescription('') }}
    className="text-xs text-pdi-slate hover:text-pdi-granite transition-colors"
  >
    Clear form
  </button>
)}
```

- [ ] **Step 3: Add resize and min/max height to description textarea**

```tsx
// BEFORE
rows={3}
className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent resize-none"

// AFTER
rows={3}
className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent resize-y min-h-[4.5rem] max-h-48"
```

- [ ] **Step 4: Add Ctrl+Enter keyboard shortcut with hint**

Add keyboard handler to the description textarea:

```tsx
// Add onKeyDown to description textarea
onKeyDown={(e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault()
    handleSubmit(e as any)
  }
}}
```

Add hint text next to submit button:

```tsx
<div className="flex items-center gap-3">
  <button type="submit" ...>
    {loading ? 'Investigating...' : 'Investigate'}
  </button>
  <span className="text-xs text-pdi-slate hidden sm:inline">
    or press <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 border border-pdi-cool-gray rounded">Ctrl+Enter</kbd>
  </span>
</div>
```

- [ ] **Step 5: Add gradient submit button**

```tsx
// BEFORE
className="px-5 py-2 bg-pdi-sky text-white rounded-lg font-medium text-sm hover:bg-pdi-sky/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"

// AFTER
className="px-5 py-2 bg-gradient-to-r from-pdi-sky to-pdi-ocean text-white rounded-lg font-medium text-sm hover:shadow-lg hover:shadow-pdi-sky/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0"
```

- [ ] **Step 6: Add status border accent to investigation cards**

Find the investigation card div and add a dynamic left border:

```tsx
// BEFORE
className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"

// AFTER
className={`bg-white rounded-xl border border-pdi-cool-gray shadow-sm overflow-hidden border-l-4 ${
  inv.loading ? 'border-l-pdi-sky' :
  inv.result ? 'border-l-pdi-grass' :
  inv.error ? 'border-l-pdi-orange' :
  'border-l-pdi-cool-gray'
}`}
```

- [ ] **Step 7: Add shimmer skeleton for loading state**

Replace the bouncing dots loading state with a shimmer skeleton:

```tsx
// BEFORE — bouncing dots
{inv.loading && (
  <div className="flex items-center gap-2 text-pdi-slate text-sm py-4">
    <div className="flex gap-1">
      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" .../>
      ...
    </div>
    Holmes is investigating this issue...
  </div>
)}

// AFTER — shimmer skeleton
{inv.loading && (
  <div className="space-y-3 py-2">
    <div className="flex items-center gap-2 text-pdi-sky text-sm mb-4">
      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-pulse" />
      <span className="animate-pulse">Holmes is investigating...</span>
    </div>
    <div className="h-3 bg-pdi-sky/10 rounded animate-pulse w-full" />
    <div className="h-3 bg-pdi-sky/10 rounded animate-pulse w-4/5" />
    <div className="h-3 bg-pdi-sky/10 rounded animate-pulse w-3/5" />
    <div className="h-3 bg-pdi-sky/10 rounded animate-pulse w-4/5 mt-4" />
    <div className="h-3 bg-pdi-sky/10 rounded animate-pulse w-full" />
  </div>
)}
```

- [ ] **Step 8: Add Retry button to error state**

```tsx
// BEFORE
{inv.error && (
  <div className="bg-pdi-orange/10 text-pdi-orange text-sm px-4 py-3 rounded-lg">
    {inv.error}
  </div>
)}

// AFTER — add retry button
{inv.error && (
  <div className="bg-pdi-orange/10 border border-pdi-orange/20 text-pdi-orange text-sm px-4 py-3 rounded-lg flex items-start justify-between gap-3">
    <span>{inv.error}</span>
    <button
      onClick={() => investigate(inv.title, inv.description || '', inv.source, {})}
      className="shrink-0 text-xs font-medium text-pdi-orange border border-pdi-orange/40 px-2.5 py-1 rounded hover:bg-pdi-orange/10 transition-colors"
    >
      Retry
    </button>
  </div>
)}
```

Note: This requires `inv.description` and `inv.source` to be stored on the investigation object. Check `useInvestigate` hook — if these fields aren't stored, add them.

- [ ] **Step 9: Update investigation header border color**

```tsx
// BEFORE
className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"

// AFTER
className="px-5 py-3 border-b border-pdi-cool-gray/50 flex items-center justify-between"
```

- [ ] **Step 10: Verify Investigate renders correctly**

Check:
- Form stays pinned at top when scrolling results
- Form not cleared on submit
- Gradient submit button
- Status border colors on cards
- Shimmer skeleton during loading
- Retry button on errors

- [ ] **Step 11: Commit**

```bash
git add infra/frontend/src/components/Investigate.tsx
git commit -s --no-verify -m "feat(ui): improve Investigate with pinned form, gradient button, status borders, shimmer loading"
```

---

## Chunk 7: Projects Component

### Task 7: Improve Projects page and modal

**Files:**
- Modify: `infra/frontend/src/components/Projects.tsx`

- [ ] **Step 1: Replace gray-* colors with PDI equivalents throughout**

Do a find-and-replace in `Projects.tsx`:

| Find | Replace |
|---|---|
| `text-gray-900` | `text-pdi-granite` |
| `text-gray-700` | `text-pdi-granite` |
| `text-gray-600` | `text-pdi-slate` |
| `text-gray-500` | `text-pdi-slate` |
| `text-gray-400` | `text-pdi-slate/60` |
| `border-gray-200` | `border-pdi-cool-gray` |
| `border-gray-300` | `border-pdi-cool-gray` |
| `border-gray-100` | `border-pdi-cool-gray/50` |
| `bg-gray-100` | `bg-pdi-cool-gray/30` |
| `hover:bg-gray-50` | `hover:bg-gray-50` (keep) |
| `hover:bg-gray-200` | `hover:bg-pdi-cool-gray/50` |

- [ ] **Step 2: Improve project card design**

Update the project card to have a hover effect and better visual hierarchy:

```tsx
// BEFORE
className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-start justify-between gap-4"

// AFTER
className="bg-white rounded-xl border border-pdi-cool-gray px-5 py-4 flex items-start justify-between gap-4 hover:border-pdi-sky/40 hover:shadow-sm transition-all group"
```

- [ ] **Step 3: Add colored left accent to project cards**

Add a left border accent to project cards:

```tsx
// Add to project card div
className="bg-white rounded-xl border border-pdi-cool-gray border-l-4 border-l-pdi-sky/30 px-5 py-4 flex items-start justify-between gap-4 hover:border-l-pdi-sky hover:shadow-sm transition-all group"
```

- [ ] **Step 4: Improve empty state with PDI branding**

```tsx
// BEFORE
<div className="text-center py-16 text-gray-400">
  <svg className="w-12 h-12 mx-auto mb-3 opacity-40" ...>
  <p className="text-sm">No projects yet. Create one to get started.</p>
</div>

// AFTER
<div className="text-center py-16">
  <div className="w-16 h-16 rounded-2xl bg-pdi-sky/10 flex items-center justify-center mx-auto mb-4">
    <svg className="w-8 h-8 text-pdi-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  </div>
  <h3 className="text-pdi-granite font-semibold text-lg mb-1">No projects yet</h3>
  <p className="text-pdi-slate text-sm max-w-sm mx-auto">
    Create a project to scope your investigations to specific tagged instances.
  </p>
  <button
    onClick={() => setEditingProject(null)}
    className="mt-4 px-4 py-2 text-sm font-medium text-white bg-pdi-sky rounded-lg hover:bg-pdi-indigo transition-colors"
  >
    Create your first project
  </button>
</div>
```

- [ ] **Step 5: Improve modal header with gradient accent**

```tsx
// BEFORE
<div className="px-6 py-4 border-b border-gray-100">
  <h2 className="text-lg font-semibold text-gray-900">

// AFTER
<div className="px-6 py-4 border-b border-pdi-cool-gray/50 relative">
  <h2 className="text-lg font-semibold text-pdi-granite">
  {/* gradient accent */}
  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pdi-sky via-pdi-ocean to-transparent opacity-60" />
</div>
```

- [ ] **Step 6: Improve modal save button**

```tsx
// BEFORE
className="px-4 py-2 text-sm font-medium text-white bg-pdi-sky rounded-lg hover:bg-pdi-indigo transition-colors disabled:opacity-50"

// AFTER
className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pdi-sky to-pdi-ocean rounded-lg hover:shadow-md hover:shadow-pdi-sky/20 transition-all disabled:opacity-50 disabled:shadow-none"
```

- [ ] **Step 7: Improve TagFilterEditor AND/OR toggle**

The toggle buttons already use PDI colors. Enhance the active state:

```tsx
// BEFORE active state
'bg-pdi-sky text-white border-pdi-sky'

// AFTER active state — add shadow
'bg-pdi-sky text-white border-pdi-sky shadow-sm shadow-pdi-sky/30'
```

- [ ] **Step 8: Improve InstancePreviewPanel**

```tsx
// BEFORE
<div className="border border-gray-200 rounded-lg p-3 bg-gray-50">

// AFTER
<div className="border border-pdi-cool-gray rounded-lg p-3 bg-pdi-sky/3">
```

Update the "global" badge:

```tsx
// BEFORE
<span className="text-xs text-pdi-sun bg-pdi-sun/10 px-1.5 py-0.5 rounded-full">global</span>

// AFTER — keep, already good
```

- [ ] **Step 9: Verify Projects renders correctly**

Check:
- All gray-* replaced with PDI equivalents
- Project cards have hover effect and left accent
- Empty state has icon + CTA button
- Modal has gradient header accent
- Save button has gradient

- [ ] **Step 10: Commit**

```bash
git add infra/frontend/src/components/Projects.tsx
git commit -s --no-verify -m "feat(ui): improve Projects with PDI colors, card hover effects, enhanced empty state"
```

---

## Chunk 8: Integrations Component

### Task 8: Improve Integrations page

**Files:**
- Modify: `infra/frontend/src/components/Integrations.tsx`

- [ ] **Step 1: Read the current Integrations.tsx**

Use the Read tool on `infra/frontend/src/components/Integrations.tsx` to understand the current structure before making changes.

- [ ] **Step 2: Replace gray-* colors with PDI equivalents**

Apply the same color replacement table as in Task 7:

| Find | Replace |
|---|---|
| `text-gray-900` | `text-pdi-granite` |
| `text-gray-700` | `text-pdi-granite` |
| `text-gray-600` | `text-pdi-slate` |
| `text-gray-500` | `text-pdi-slate` |
| `border-gray-200` | `border-pdi-cool-gray` |
| `border-gray-300` | `border-pdi-cool-gray` |

- [ ] **Step 3: Improve integration card status indicators**

Find status indicator elements (enabled/disabled/connected/error) and update:

```tsx
// Enabled/connected status
<span className="inline-flex items-center gap-1 text-xs font-medium text-pdi-grass bg-pdi-grass/10 px-2 py-0.5 rounded-full">
  <span className="w-1.5 h-1.5 rounded-full bg-pdi-grass" />
  Connected
</span>

// Disabled status
<span className="inline-flex items-center gap-1 text-xs font-medium text-pdi-slate bg-pdi-cool-gray/30 px-2 py-0.5 rounded-full">
  <span className="w-1.5 h-1.5 rounded-full bg-pdi-slate" />
  Disabled
</span>

// Error status
<span className="inline-flex items-center gap-1 text-xs font-medium text-pdi-orange bg-pdi-orange/10 px-2 py-0.5 rounded-full">
  <span className="w-1.5 h-1.5 rounded-full bg-pdi-orange animate-pulse" />
  Error
</span>
```

- [ ] **Step 4: Improve toggle switch styling**

Find toggle/checkbox elements for enabling integrations and update to use PDI colors:

```tsx
// If using a custom toggle, update checked state:
// checked: bg-pdi-sky
// unchecked: bg-pdi-cool-gray
// thumb: bg-white shadow-sm
```

- [ ] **Step 5: Add hover effect to integration cards**

```tsx
// Add to integration card container
className="... hover:border-pdi-sky/40 hover:shadow-sm transition-all"
```

- [ ] **Step 6: Verify Integrations renders correctly**

Check:
- PDI colors throughout
- Status badges use correct PDI colors
- Cards have hover effects

- [ ] **Step 7: Commit**

```bash
git add infra/frontend/src/components/Integrations.tsx
git commit -s --no-verify -m "feat(ui): improve Integrations with PDI colors, status badges, card hover effects"
```

---

## Chunk 9: History and Settings Pages

### Task 9: Apply PDI color consistency to remaining pages

**Files:**
- Modify: `infra/frontend/src/components/History.tsx` (if exists)
- Modify: `infra/frontend/src/components/Settings.tsx` (if exists)
- Modify: `infra/frontend/src/components/Instances.tsx` (if exists)

- [ ] **Step 1: Check which additional component files exist**

```bash
ls infra/frontend/src/components/
```

- [ ] **Step 2: Apply PDI color replacements to each file**

For each file found, apply the same color replacement table:

| Find | Replace |
|---|---|
| `text-gray-900` | `text-pdi-granite` |
| `text-gray-700` | `text-pdi-granite` |
| `text-gray-600` | `text-pdi-slate` |
| `text-gray-500` | `text-pdi-slate` |
| `text-gray-400` | `text-pdi-slate/60` |
| `border-gray-200` | `border-pdi-cool-gray` |
| `border-gray-300` | `border-pdi-cool-gray` |
| `border-gray-100` | `border-pdi-cool-gray/50` |

- [ ] **Step 3: Ensure page headers have gradient accent lines**

For each page with a header section, add the gradient accent line pattern:

```tsx
// Add to page header divs that have border-b
<div className="... border-b border-pdi-cool-gray relative">
  {/* content */}
  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-pdi-sky via-pdi-ocean to-transparent opacity-40" />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add infra/frontend/src/components/
git commit -s --no-verify -m "feat(ui): apply PDI color consistency to History, Settings, Instances pages"
```

---

## Chunk 10: Final Polish

### Task 10: Global CSS and animation polish

**Files:**
- Modify: `infra/frontend/src/styles/globals.css`
- Modify: `infra/frontend/tailwind.config.js`

- [ ] **Step 1: Add smooth page transition animation**

In `globals.css`, add a fade-in animation for page content:

```css
/* Page content fade-in */
.page-content {
  animation: fadeUp 0.2s ease-out;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 2: Add `page-content` class to main content areas**

In `App.tsx` or `Layout.tsx`, add `page-content` class to the main content wrapper:

```tsx
<main className="flex-1 overflow-hidden page-content">
  {children}
</main>
```

- [ ] **Step 3: Verify scrollbar styling uses PDI colors**

In `globals.css`, check the scrollbar styling. Update if needed:

```css
::-webkit-scrollbar-thumb {
  background-color: #d6d8d6; /* pdi-cool-gray */
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background-color: #8e9c9c; /* pdi-slate */
}
```

- [ ] **Step 4: Final visual review**

Open the app and navigate through all pages:
- [ ] Login page: gradient background, SVG logo
- [ ] Sidebar: consistent opacity, visible logout icon
- [ ] Chat: suggestion chips send directly, auto-growing textarea
- [ ] MessageBubble: muted user bubble, Holmes avatar, copy button
- [ ] ToolCallCard: PDI colors, copy button
- [ ] Investigate: pinned form, gradient button, status borders
- [ ] Projects: PDI colors, card hover, empty state CTA
- [ ] Integrations: PDI colors, status badges

- [ ] **Step 5: Final commit**

```bash
git add infra/frontend/src/styles/globals.css infra/frontend/tailwind.config.js
git commit -s --no-verify -m "feat(ui): add page transition animation and polish global CSS"
```

---

## Summary

This plan covers 10 tasks across 10 chunks, touching 9 component files. Each task is self-contained and produces a working, visually improved component. The changes are:

1. **LoginPage** — gradient background, SVG logo, accessibility labels
2. **Layout/Sidebar** — consistent opacity, visible logout, gradient accents
3. **Chat** — direct-send chips, auto-growing textarea, clear confirmation
4. **MessageBubble** — muted user bubble, Holmes avatar, copy button
5. **ToolCallCard** — PDI brand colors, copy button, status border
6. **Investigate** — pinned form, gradient button, shimmer loading, status borders
7. **Projects** — PDI colors throughout, card hover, enhanced empty state
8. **Integrations** — PDI colors, status badges, card hover
9. **History/Settings/Instances** — PDI color consistency
10. **Global CSS** — page transition animation, scrollbar polish

All changes use existing Tailwind classes from the PDI palette — no new dependencies required.
