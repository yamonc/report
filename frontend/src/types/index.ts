export interface DailyReport {
  date: string
  content: string
  created_at: string
  updated_at: string
}

export interface WeeklyReport {
  id: string
  week_start: string
  week_end: string
  content: string
  status: 'draft' | 'confirmed'
  created_at: string
  updated_at: string
}

export interface AISettings {
  provider: string
  base_url: string
  api_key: string
  model: string
}

export interface User {
  email: string
  created_at: string
}

export interface LoginReq {
  email: string
  password: string
}

export interface LoginResp {
  token: string
  user: User
}

export interface ReminderTask {
  id: string
  name: string
  enabled: boolean
  schedule_type: 'daily' | 'weekly'
  time: string
  weekday: number
  message: string
  created_at: string
}

export interface SMTPConfig {
  host: string
  port: number
  username: string
  password: string
}

export interface FullSettings {
  ai: AISettings
  smtp: SMTPConfig
  reminders: ReminderTask[]
}
