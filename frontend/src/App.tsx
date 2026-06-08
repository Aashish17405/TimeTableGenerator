import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SchoolProvider } from './features/school/SchoolContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import SchoolsPage from './pages/SchoolsPage'
import SubjectsPage from './pages/SubjectsPage'
import ClassesPage from './pages/ClassesPage'
import SectionsPage from './pages/SectionsPage'
import TeachersPage from './pages/TeachersPage'
import RequirementsPage from './pages/RequirementsPage'
import AllocationsPage from './pages/AllocationsPage'
import TimetablesPage from './pages/TimetablesPage'
import AITimetablePage from './pages/AITimetablePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SchoolProvider>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="schools" element={<SchoolsPage />} />
                <Route path="subjects" element={<SubjectsPage />} />
                <Route path="classes" element={<ClassesPage />} />
                <Route path="sections" element={<SectionsPage />} />
                <Route path="teachers" element={<TeachersPage />} />
                <Route path="requirements" element={<RequirementsPage />} />
                <Route path="allocations" element={<AllocationsPage />} />
                <Route path="timetables" element={<TimetablesPage />} />
                <Route path="ai-timetable" element={<AITimetablePage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SchoolProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
