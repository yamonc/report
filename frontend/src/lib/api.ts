import type { DailyReport, FullSettings, LoginResp, ReminderTask, WeeklyReport } from '../types'

const BASE = '/api/v1'

function getToken(): string | null {
  return localStorage.getItem('token')
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(`${BASE}${url}`, {
    headers,
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || '请求失败')
  }
  return res.json()
}

export const api = {
  // Auth
  login(email: string, password: string) {
    return request<LoginResp>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },
  getMe() {
    return request<{ email: string; created_at: string }>('/auth/me')
  },

  // Daily reports
  getDailyReport(date: string) {
    return request<DailyReport>(`/daily-reports/${date}`)
  },
  saveDailyReport(date: string, content: string) {
    return request<DailyReport>(`/daily-reports/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ date, content }),
    })
  },
  listDailyReports(from?: string, to?: string) {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    return request<DailyReport[]>(`/daily-reports?${params}`)
  },

  // Weekly reports
  generateWeeklyReport(weekStart: string, weekEnd: string) {
    return request<WeeklyReport>('/weekly-reports/generate', {
      method: 'POST',
      body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
    })
  },
  getWeeklyReport(id: string) {
    return request<WeeklyReport>(`/weekly-reports/${id}`)
  },
  updateWeeklyReport(id: string, data: { content?: string; status?: string }) {
    return request<WeeklyReport>(`/weekly-reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  listWeeklyReports(weekStart?: string) {
    const params = new URLSearchParams()
    if (weekStart) params.set('week_start', weekStart)
    return request<WeeklyReport[]>(`/weekly-reports?${params}`)
  },

  // Settings (extended — AI + SMTP + reminders)
  getSettings() {
    return request<FullSettings>('/settings')
  },
  saveSettings(settings: FullSettings) {
    return request<{ status: string }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    })
  },

  // Reminders
  listReminders() {
    return request<ReminderTask[]>('/reminders')
  },
  createReminder(data: Partial<ReminderTask>) {
    return request<ReminderTask>('/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
  updateReminder(id: string, data: Partial<ReminderTask>) {
    return request<ReminderTask>(`/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },
  deleteReminder(id: string) {
    return request<{ status: string }>(`/reminders/${id}`, {
      method: 'DELETE',
    })
  },
}
