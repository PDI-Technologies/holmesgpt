import { ReactNode } from 'react'
import type { Page } from '../App'
import type { Project } from '../lib/api'

interface LayoutProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onLogout: () => void
  children: ReactNode
  projects: Project[]
  selectedProjectId: string | null
  selectedProject: Project | null
  onSelectProject: (id: string | null) => void
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'chat', label: 'Chat', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z' },
  { page: 'investigate', label: 'Investigate', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
  { page: 'history', label: 'History', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
  { page: 'integrations', label: 'Integrations', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
  { page: 'instances', label: 'Instances', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01' },
  { page: 'projects', label: 'Projects', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z' },
  { page: 'docs', label: 'Docs', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
  { page: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

export default function Layout({
  currentPage,
  onNavigate,
  onLogout,
  children,
  projects,
  selectedProjectId,
  selectedProject,
  onSelectProject,
}: LayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-pdi-indigo flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-5 py-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-pdi-sky flex items-center justify-center">
              <span className="text-white font-extrabold text-lg">H</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">HolmesGPT</h1>
              <p className="text-pdi-sky text-xs font-medium">PDI Technologies</p>
            </div>
          </div>
        </div>

        {/* Project selector */}
        <div className="px-3 pt-3 pb-1 border-b border-white/10">
          <label className="block text-white/40 text-xs font-medium uppercase tracking-wider mb-1.5 px-1">
            Project
          </label>
          <select
            value={selectedProjectId ?? ''}
            onChange={(e) => onSelectProject(e.target.value || null)}
            className="w-full text-sm bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pdi-sky appearance-none cursor-pointer"
          >
            <option value="" className="bg-white text-gray-900">All integrations</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id} className="bg-white text-gray-900">
                {p.name}
              </option>
            ))}
          </select>
          {selectedProject && selectedProject.tag_filter && Object.keys(selectedProject.tag_filter.tags).length > 0 && (
            <p className="text-white/40 text-xs mt-1 px-1 truncate">
              {selectedProject.tag_filter.logic}: {Object.entries(selectedProject.tag_filter.tags).map(([k, v]) => `${k}=${v}`).join(', ')}
            </p>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ page, label, icon }) => (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-pdi-sky/20 text-pdi-sky'
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
              </svg>
              {label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 text-white/50 hover:text-white/80 text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
