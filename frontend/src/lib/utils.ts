export function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })
}

export function getToday(): string {
  return new Date().toISOString().slice(0, 10)
}

export function getWeekStart(date?: Date): string {
  const d = date || new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().slice(0, 10)
}

export function getWeekEnd(date?: Date): string {
  const d = date || new Date()
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? 0 : 7)
  const sunday = new Date(d.setDate(diff))
  return sunday.toISOString().slice(0, 10)
}

export function getWeekLabel(weekStart: string, weekEnd: string): string {
  return `${weekStart} ~ ${weekEnd}`
}

export function cn(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
