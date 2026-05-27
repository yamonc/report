import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

interface CalendarProps {
  year: number
  month: number
  selectedDate: string
  datesWithReports: Set<string>
  onSelectDate: (date: string) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function buildWeeks(year: number, month: number): (number | null)[][] {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = []

  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(null)
  }
  for (let day = 1; day <= daysInMonth; day++) {
    currentWeek.push(day)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    weeks.push(currentWeek)
  }
  return weeks
}

export default function Calendar({
  year,
  month,
  selectedDate,
  datesWithReports,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
}: CalendarProps) {
  const today = new Date().toISOString().slice(0, 10)
  const weeks = buildWeeks(year, month)

  return (
    <div className="select-none animate-fade-up stagger-2">
      {/* Month header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          onClick={onPrevMonth}
          className="rounded-lg p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-serif text-lg font-semibold text-text-primary tracking-wide">
          {year}年{month}月
        </span>
        <button
          onClick={onNextMonth}
          className="rounded-lg p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              'py-2 text-center text-xs font-medium tracking-wider',
              i >= 5 ? 'text-text-tertiary' : 'text-text-secondary',
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 rounded-lg border border-border overflow-hidden bg-bg-surface/50">
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day === null) {
              return (
                <div
                  key={`${wi}-${di}`}
                  className="border-r border-b border-border-subtle bg-bg-root/30 min-h-[56px]"
                />
              )
            }
            const dateStr = formatDate(year, month, day)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const hasReport = datesWithReports.has(dateStr)

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={cn(
                  'border-r border-b border-border-subtle min-h-[56px] flex flex-col items-center justify-center gap-1 transition-all duration-150',
                  isSelected && 'bg-accent-subtle',
                  !isSelected && 'hover:bg-bg-hover',
                )}
                type="button"
              >
                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition-colors',
                    isToday && 'bg-accent font-semibold text-[#1a1a16]',
                    isSelected && !isToday && 'font-bold text-accent',
                    !isToday && !isSelected && 'text-text-secondary',
                  )}
                >
                  {day}
                </span>
                {hasReport && (
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isToday ? 'bg-[#1a1a16]/60' : 'bg-accent/70',
                  )} />
                )}
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}
