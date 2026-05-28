import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, ProtectedRoute } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DailyReportPage from './pages/DailyReport'
import WeeklyReportPage from './pages/WeeklyReport'
import TasksPage from './pages/Tasks'
import KnowledgePage from './pages/Knowledge'
import SettingsPage from './pages/Settings'
import LoginPage from './pages/Login'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="daily" element={<DailyReportPage />} />
            <Route path="daily/:date" element={<DailyReportPage />} />
            <Route path="weekly" element={<WeeklyReportPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="knowledge" element={<KnowledgePage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
