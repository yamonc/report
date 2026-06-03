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
  const daysInMonth = getDaysInMonth(year, month)

  // Count filled days this month (workdays only)
  let workdayCount = 0
  let filledWorkdayCount = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay() // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      workdayCount++
      if (datesWithReports.has(formatDate(year, month, d))) {
        filledWorkdayCount++
      }
    }
  }


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

      {/* Stats bar */}
      <div className="mb-3 flex items-center gap-4 text-xs text-text-secondary">
        <span>
          已填写{' '}
          <strong className="text-success font-semibold">{filledWorkdayCount}</strong>
          {' '}/{' '}
          <span className="text-text-tertiary">{workdayCount}</span> 工作日
        </span>
        {workdayCount > 0 && (
          <span className="text-text-tertiary">
            完成率{' '}
            <strong className={cn(
              'font-semibold',
              filledWorkdayCount / workdayCount >= 0.8 ? 'text-success' : 'text-warning',
            )}>
              {Math.round((filledWorkdayCount / workdayCount) * 100)}%
            </strong>
          </span>
        )}
        {daysInMonth - workdayCount > 0 && (
          <span className="text-text-tertiary/50">
            周末 {daysInMonth - workdayCount} 天不计
          </span>
        )}
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
      <div className="grid grid-cols-7 rounded-lg overflow-hidden border border-border bg-bg-elevated">
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day === null) {
              return (
                <div
                  key={`${wi}-${di}`}
                  className="border-r border-b border-border-subtle bg-bg-root/30 min-h-[62px]"
                />
              )
            }
            const dateStr = formatDate(year, month, day)
            const isToday = dateStr === today
            const isSelected = dateStr === selectedDate
            const hasReport = datesWithReports.has(dateStr)
            const dow = new Date(year, month - 1, day).getDay() // 0=Sun, 6=Sat
            const isWeekend = dow === 0 || dow === 6

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                className={cn(
                  'border-r border-b border-border-subtle min-h-[62px] flex flex-col items-center justify-center gap-0.5 transition-all duration-150 relative',
                  // Weekend dimming
                  isWeekend && 'bg-bg-root/40',
                  // Filled vs empty distinction (weekdays only matter)
                  hasReport
                    ? 'bg-success-bg'
                    : '',
                  // Selected state
                  isSelected && 'ring-2 ring-accent ring-inset z-10',
                  // Hover
                  !isSelected && 'hover:bg-bg-hover',
                )}
                type="button"
              >
                {/* Today indicator ring */}
                {isToday && (
                  <div className="absolute inset-1 rounded-md ring-1 ring-accent/40 pointer-events-none" />
                )}

                <span
                  className={cn(
                    'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    // Today: accent filled
                    isToday && 'bg-accent font-semibold text-[#1a1a16]',
                    // Selected but not today
                    isSelected && !isToday && 'font-bold text-accent',
                    // Has report but not today/selected
                    hasReport && !isToday && !isSelected && 'text-success font-medium',
                    // No report and not today
                    !hasReport && !isToday && !isSelected && 'text-text-tertiary',
                    // Weekend dim
                    isWeekend && !isToday && !isSelected && !hasReport && 'opacity-30',
                  )}
                >
                  {day}
                </span>

                {/* Checkmark for filled days (larger & clearer than old dot) */}
                {hasReport && (
                  <svg
                    className={cn(
                      'h-3 w-3 mt-px',
                      isToday ? 'text-[#1a1a16]/50' : 'text-success/60',
                    )}
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M2.5 6L5 8.5L9.5 3.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            )
          }),
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-5 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-success-bg border border-success/20" />
          已填写
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-transparent border border-border-subtle" />
          未填写
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent" />
          今日
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm border-2 border-accent bg-transparent" />
          选中
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3.5 w-3.5 rounded-sm bg-bg-root/40 border border-border-subtle" />
          周末不计
        </span>
      </div>
    </div>
  )
}
