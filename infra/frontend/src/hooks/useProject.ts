import { useState, useCallback } from 'react'
import { api, Project } from '../lib/api'

const STORAGE_KEY = 'holmes_selected_project_id'

export function useProject() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  )
  const [loading, setLoading] = useState(false)

  const reloadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getProjects()
      setProjects(data.projects)
      // If the selected project was deleted, clear the selection
      if (selectedProjectId && !data.projects.find((p) => p.id === selectedProjectId)) {
        setSelectedProjectId(null)
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (err) {
      console.error('Failed to load projects', err)
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  // Projects are loaded by App.tsx after authentication is confirmed
  // (no auto-load on mount to avoid 401 before auth cookie is set)

  const selectProject = useCallback((id: string | null) => {
    setSelectedProjectId(id)
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null

  return { projects, selectedProjectId, selectedProject, selectProject, reloadProjects, loading }
}
