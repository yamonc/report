import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider, ProtectedRoute } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import DailyReportPage from './pages/DailyReport'
import WeeklyReportPage from './pages/WeeklyReport'
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
            <Route index element={<Dashboard />} />
            <Route path="daily" element={<DailyReportPage />} />
            <Route path="daily/:date" element={<DailyReportPage />} />
            <Route path="weekly" element={<WeeklyReportPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
