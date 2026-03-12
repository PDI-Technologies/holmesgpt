import { useState, useRef, useCallback } from 'react'
import { type ChatMessage as ApiChatMessage } from '../lib/api'

interface ToolCall {
  tool_name: string
  description: string
  result: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  loading?: boolean
}

// SSE event types emitted by the Holmes streaming endpoint
type SseEvent =
  | 'ai_message'
  | 'start_tool_calling'
  | 'tool_calling_result'
  | 'ai_answer_end'
  | 'error'
  | 'token_count'
  | 'conversation_history_compacted'

function parseSseChunk(chunk: string): Array<{ event: SseEvent; data: unknown }> {
  const results: Array<{ event: SseEvent; data: unknown }> = []
  // SSE format: "event: <type>\ndata: <json>\n\n"
  const blocks = chunk.split('\n\n').filter(Boolean)
  for (const block of blocks) {
    const lines = block.split('\n')
    let event: SseEvent | null = null
    let dataStr = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7).trim() as SseEvent
      else if (line.startsWith('data: ')) dataStr = line.slice(6).trim()
    }
    if (event && dataStr) {
      try {
        results.push({ event, data: JSON.parse(dataStr) })
      } catch {
        // ignore malformed chunks
      }
    }
  }
  return results
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  // Server-managed conversation history (starts with system message — required by backend)
  const serverHistoryRef = useRef<ApiChatMessage[]>([])

  const sendMessage = useCallback(
    async (text: string) => {
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: text,
      }

      const assistantId = crypto.randomUUID()
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        loading: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setLoading(true)

      const controller = new AbortController()
      abortRef.current = controller

      // Accumulate tool calls during the stream
      const pendingToolCalls: ToolCall[] = []
      let currentTool: Partial<ToolCall> | null = null

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ask: text,
            // Only send history if we have server-managed history (starts with system message).
            // On the first message serverHistoryRef is empty — omitting it lets the server
            // build the history from scratch with the correct system prompt.
            conversation_history: serverHistoryRef.current.length > 0
              ? serverHistoryRef.current
              : undefined,
            stream: true,
            include_tool_calls: true,
            include_tool_call_results: true,
          }),
          signal: controller.signal,
        })

        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        if (!res.ok) {
          const errText = await res.text()
          throw new Error(`${res.status}: ${errText}`)
        }
        if (!res.body) throw new Error('No response body')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE blocks (terminated by \n\n)
          const boundary = buffer.lastIndexOf('\n\n')
          if (boundary === -1) continue

          const toProcess = buffer.slice(0, boundary + 2)
          buffer = buffer.slice(boundary + 2)

          const events = parseSseChunk(toProcess)

          for (const { event, data } of events) {
            const d = data as Record<string, unknown>

            if (event === 'ai_message') {
              // Full LLM response content for this turn (not a delta — replace content)
              const content = (d.content as string) ?? ''
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content } : m,
                ),
              )
            } else if (event === 'start_tool_calling') {
              // New tool call starting — tool_name comes here, description with result
              currentTool = {
                tool_name: (d.tool_name as string) ?? '',
                description: '',
                result: '',
              }
            } else if (event === 'tool_calling_result') {
              // Tool result arrived — fields: name, description, result (object with data)
              const toolName = (d.name as string) ?? currentTool?.tool_name ?? ''
              const description = (d.description as string) ?? ''
              const resultObj = d.result as Record<string, unknown> | undefined
              const resultStr = (resultObj?.data as string) ?? JSON.stringify(resultObj ?? '')
              pendingToolCalls.push({ tool_name: toolName, description, result: resultStr })
              currentTool = null
              // Update tool calls in the message as they arrive
              const snapshot = [...pendingToolCalls]
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolCalls: snapshot } : m,
                ),
              )
            } else if (event === 'ai_answer_end') {
              // Final answer — server returns the full conversation_history (system msg first).
              // Store it for the next turn so the backend gets the correct format.
              const analysis = (d.analysis as string) ?? ''
              const serverHistory = d.conversation_history as ApiChatMessage[] | undefined
              if (serverHistory && serverHistory.length > 0) {
                serverHistoryRef.current = serverHistory
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: analysis, toolCalls: [...pendingToolCalls], loading: false }
                    : m,
                ),
              )
            } else if (event === 'conversation_history_compacted') {
              // Server compacted the history — update our ref with the new compacted version
              const compacted = d.conversation_history as ApiChatMessage[] | undefined
              if (compacted && compacted.length > 0) {
                serverHistoryRef.current = compacted
              }
            } else if (event === 'error') {
              const msg = (d.msg as string) ?? (d.description as string) ?? 'Stream error'
              throw new Error(msg)
            }
          }
        }

        // If stream ended without ai_answer_end (e.g. non-streaming fallback)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.loading ? { ...m, loading: false } : m,
          ),
        )
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${errorMessage}`, loading: false }
              : m,
          ),
        )
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const clearMessages = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setLoading(false)
    serverHistoryRef.current = []
  }, [])

  return { messages, loading, sendMessage, clearMessages }
}
