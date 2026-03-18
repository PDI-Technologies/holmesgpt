import { useState, useEffect } from 'react'
import Layout from './components/Layout'
import Chat from './components/Chat'
import Investigate from './components/Investigate'
import InvestigationHistory from './components/InvestigationHistory'
import Integrations from './components/Integrations'
import Settings from './components/Settings'
import Projects from './components/Projects'
import Instances from './components/Instances'
import Analytics from './components/Analytics'
import Docs from './components/Docs'
import LoginPage from './components/LoginPage'
import { api } from './lib/api'
import { useProject } from './hooks/useProject'

export type Page = 'chat' | 'investigate' | 'history' | 'analytics' | 'integrations' | 'instances' | 'settings' | 'projects' | 'docs'

export default function App() {
  const [page, setPage] = useState<Page>('chat')
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const { projects, selectedProjectId, selectedProject, selectProject, reloadProjects } = useProject()

  useEffect(() => {
    api.checkAuth().then(setAuthenticated)
  }, [])

  // Load projects once authentication is confirmed
  useEffect(() => {
    if (authenticated === true) {
      reloadProjects()
    }
  }, [authenticated]) // eslint-disable-line react-hooks/exhaustive-deps

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
      projects={projects}
      selectedProjectId={selectedProjectId}
      selectedProject={selectedProject}
      onSelectProject={selectProject}
    >
      <div key={page} className="page-transition h-full">
        {page === 'chat' && <Chat projectId={selectedProjectId} />}
        {page === 'investigate' && <Investigate projectId={selectedProjectId} selectedProject={selectedProject} />}
        {page === 'history' && <InvestigationHistory />}
        {page === 'analytics' && <Analytics />}
        {page === 'integrations' && <Integrations />}
        {page === 'settings' && <Settings />}
        {page === 'projects' && <Projects projects={projects} onReload={reloadProjects} />}
        {page === 'instances' && <Instances selectedProjectId={selectedProjectId} />}
        {page === 'docs' && <Docs />}
      </div>
    </Layout>
  )
}
