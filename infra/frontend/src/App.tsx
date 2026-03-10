import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Chat from './components/Chat'
import Investigate from './components/Investigate'
import Integrations from './components/Integrations'
import Settings from './components/Settings'
import LoginPage from './components/LoginPage'
import { api } from './lib/api'

export type Page = 'chat' | 'investigate' | 'integrations' | 'settings'

export default function App() {
  const [page, setPage] = useState<Page>('chat')
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    api.checkAuth().then(setAuthenticated)
  }, [])

  if (authenticated === null) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="animate-pulse text-pdi-slate text-lg">Loading...</div>
      </div>
    )
  }

  if (!authenticated) {
    return <LoginPage onLogin={() => setAuthenticated(true)} />
  }

  return (
    <Layout
      currentPage={page}
      onNavigate={setPage}
      onLogout={async () => {
        await api.logout()
        setAuthenticated(false)
      }}
    >
      {page === 'chat' && <Chat />}
      {page === 'investigate' && <Investigate />}
      {page === 'integrations' && <Integrations />}
      {page === 'settings' && <Settings />}
    </Layout>
  )
}
