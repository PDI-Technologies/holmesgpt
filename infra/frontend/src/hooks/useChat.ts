import { useState, useRef, useCallback } from 'react'
import { api, type ChatMessage as ApiChatMessage } from '../lib/api'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { tool_name: string; description: string; result: string }[]
  loading?: boolean
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (text: string) => {
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }

    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      loading: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setLoading(true)

    // Build conversation history from previous messages
    const history: ApiChatMessage[] = messages
      .filter((m) => !m.loading)
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const response = await api.chat({
        ask: text,
        conversation_history: history,
      })

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: response.analysis,
                toolCalls: response.tool_calls,
                loading: false,
              }
            : m,
        ),
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Something went wrong'
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: `Error: ${errorMessage}`, loading: false }
            : m,
        ),
      )
    } finally {
      setLoading(false)
    }
  }, [messages])

  const clearMessages = useCallback(() => {
    if (abortRef.current) abortRef.current.abort()
    setMessages([])
    setLoading(false)
  }, [])

  return { messages, loading, sendMessage, clearMessages }
}
