import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { schoolsApi } from '../../services/api'
import type { School } from '../../types'

const STORAGE_KEY = 'timetable_active_school_id'

interface SchoolContextValue {
  schools: School[]
  activeSchool: School | null
  activeSchoolId: number | null
  setActiveSchool: (school: School) => void
  isLoading: boolean
}

const SchoolContext = createContext<SchoolContextValue | null>(null)

export function SchoolProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { data: paginatedData, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schoolsApi.list(1, 1000),
    staleTime: 60_000,
  })
  const schools = paginatedData?.items || []

  const [activeSchoolId, setActiveSchoolId] = useState<number | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : null
  })

  // Auto-select first school when list loads and nothing is stored
  useEffect(() => {
    if (!isLoading && schools.length > 0) {
      const stored = localStorage.getItem(STORAGE_KEY)
      const storedId = stored ? Number(stored) : null
      const exists = storedId && schools.some(s => s.id === storedId)
      if (!exists) {
        setActiveSchoolId(schools[0].id)
        localStorage.setItem(STORAGE_KEY, String(schools[0].id))
      }
    }
  }, [schools, isLoading])

  const setActiveSchool = useCallback(
    (school: School) => {
      setActiveSchoolId(school.id)
      localStorage.setItem(STORAGE_KEY, String(school.id))
      // Invalidate all school-scoped queries when switching school
      qc.invalidateQueries({ queryKey: ['classes'] })
      qc.invalidateQueries({ queryKey: ['sections'] })
      qc.invalidateQueries({ queryKey: ['teachers'] })
      qc.invalidateQueries({ queryKey: ['requirements'] })
      qc.invalidateQueries({ queryKey: ['allocations'] })
      qc.invalidateQueries({ queryKey: ['teacher-class-mappings'] })
    },
    [qc]
  )

  const activeSchool = schools.find(s => s.id === activeSchoolId) ?? null

  return (
    <SchoolContext.Provider value={{ schools, activeSchool, activeSchoolId, setActiveSchool, isLoading }}>
      {children}
    </SchoolContext.Provider>
  )
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool must be used within SchoolProvider')
  return ctx
}
