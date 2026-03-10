import { useState, useRef, useEffect } from 'react'
import { useChat } from '../hooks/useChat'
import MessageBubble from './MessageBubble'
import ToolCallCard from './ToolCallCard'

export default function Chat() {
  const { messages, loading, sendMessage, clearMessages } = useChat()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-lg font-bold text-pdi-granite">Chat</h2>
          <p className="text-xs text-pdi-slate">Ask questions about your infrastructure</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-xs text-pdi-slate hover:text-pdi-granite px-3 py-1.5 rounded-lg border border-pdi-cool-gray hover:border-pdi-slate transition-colors"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-pdi-sky/10 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-pdi-sky" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-pdi-granite font-semibold text-lg mb-1">How can I help?</h3>
            <p className="text-pdi-slate text-sm max-w-md mb-6">
              Ask me anything about your Kubernetes cluster, infrastructure, or application health.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {[
                'List all pods with errors',
                'Show namespaces in this cluster',
                'Check node resource usage',
                'Find recent crash loops',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="text-left text-sm px-3 py-2 rounded-lg border border-pdi-cool-gray text-pdi-granite hover:border-pdi-sky hover:bg-pdi-sky/5 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.loading ? (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-pdi-slate text-sm">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-pdi-sky rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    Investigating...
                  </div>
                </div>
              </div>
            ) : (
              <>
                <MessageBubble role={msg.role} content={msg.content} />
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="ml-0 mt-1 max-w-[80%]">
                    {msg.toolCalls.map((tc, i) => (
                      <ToolCallCard
                        key={i}
                        toolName={tc.tool_name}
                        description={tc.description}
                        result={tc.result}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Holmes a question..."
            rows={1}
            className="flex-1 resize-none px-4 py-2.5 border border-pdi-cool-gray rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent placeholder:text-pdi-slate/60"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 bg-pdi-sky text-white rounded-xl font-medium text-sm hover:bg-pdi-sky/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  )
}
