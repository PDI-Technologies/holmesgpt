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
    <div className="min-h-screen bg-pdi-indigo flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-pdi-sky/20 mb-4">
            <span className="text-pdi-sky font-extrabold text-3xl">H</span>
          </div>
          <h1 className="text-white text-2xl font-bold">HolmesGPT</h1>
          <p className="text-pdi-sky text-sm font-medium mt-1">PDI Technologies</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 shadow-2xl">
          <h2 className="text-pdi-granite font-semibold text-lg mb-4">Sign in</h2>

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
                className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent"
                required
                autoFocus
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
                className="w-full px-3 py-2 border border-pdi-cool-gray rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pdi-sky focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pdi-sky text-white font-semibold py-2.5 rounded-lg hover:bg-pdi-sky/90 transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
