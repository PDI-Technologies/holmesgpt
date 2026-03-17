import { useState } from 'react'
import { api } from '../lib/api'

interface LoginPageProps {
  onLogin: () => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.login(username, password)
      onLogin()
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-pdi-indigo flex items-center justify-center px-4 relative overflow-hidden">
      {/* Radial gradient from top */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#1226aa33_0%,_transparent_60%)]" />
      {/* Radial gradient from bottom-right */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_#29b5e820_0%,_transparent_50%)]" />
      {/* Grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(#29b5e8_1px,transparent_1px),linear-gradient(to_right,#29b5e8_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pdi-sky to-pdi-ocean mb-4 shadow-lg shadow-pdi-sky/30">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h1 className="text-white text-2xl font-bold">HolmesGPT</h1>
          <p className="text-pdi-sky text-sm font-medium mt-1">PDI Technologies</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-2xl">
          <h2 className="text-pdi-granite font-semibold text-lg mb-4">Sign in</h2>

          <div className="h-px bg-gradient-to-r from-transparent via-pdi-cool-gray to-transparent mb-4" />

          {error && (
            <div className="bg-pdi-orange/10 text-pdi-orange text-sm px-3 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-pdi-granite mb-1">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent focus-visible:ring-2 focus-visible:ring-pdi-sky"
                required
                autoFocus
                autoComplete="username"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-pdi-granite mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent focus-visible:ring-2 focus-visible:ring-pdi-sky"
                required
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pdi-sky text-white font-semibold py-2.5 rounded-lg hover:bg-pdi-ocean active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
