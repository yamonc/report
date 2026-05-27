import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Loader2, Eye, Edit3 } from 'lucide-react'
import Calendar from '../components/Calendar'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import { api } from '../lib/api'
import { getToday, formatDate } from '../lib/utils'

export default function DailyReportPage() {
  const { date: paramDate } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const displayDate = paramDate || getToday()
  const [date, setDate] = useState(displayDate)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(false)
  const [datesWithReports, setDatesWithReports] = useState<Set<string>>(new Set())

  const d = new Date(date)
  const [viewYear, setViewYear] = useState(d.getFullYear())
  const [viewMonth, setViewMonth] = useState(d.getMonth() + 1)

  useEffect(() => {
    if (paramDate) {
      setDate(paramDate)
      const nd = new Date(paramDate)
      setViewYear(nd.getFullYear())
      setViewMonth(nd.getMonth() + 1)
    } else {
      setDate(getToday())
    }
  }, [paramDate])

  useEffect(() => {
    api.getDailyReport(date).then(r => setContent(r.content)).catch(() => setContent(''))
  }, [date])

  const fetchMonthReports = useCallback(() => {
    const m = String(viewMonth).padStart(2, '0')
    const lastDay = new Date(viewYear, viewMonth, 0).getDate()
    const monthStart = `${viewYear}-${m}-01`
    const monthEnd = `${viewYear}-${m}-${String(lastDay).padStart(2, '0')}`
    api.listDailyReports(monthStart, monthEnd)
      .then(reports => setDatesWithReports(new Set(reports.map(r => r.date))))
      .catch(() => {})
  }, [viewYear, viewMonth])

  useEffect(() => {
    fetchMonthReports()
  }, [fetchMonthReports, saved])

  const handleSelectDate = (newDate: string) => {
    setDate(newDate)
    navigate(`/daily/${newDate}`)
  }

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1)
      setViewMonth(12)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear(viewYear + 1)
      setViewMonth(1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveDailyReport(date, content)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const goToToday = () => navigate('/daily')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">日报</h1>
          <p className="mt-1.5 text-text-secondary text-sm">
            {formatDate(date)}
            {date !== getToday() && (
              <button
                onClick={goToToday}
                className="ml-3 text-accent hover:text-accent-soft text-xs font-medium transition-colors"
                type="button"
              >
                回到今天
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setPreview(!preview)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 border ${
              preview
                ? 'border-border bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                : 'border-accent/30 bg-accent-subtle text-accent hover:bg-accent/15'
            }`}
            type="button"
          >
            {preview ? <Edit3 className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {preview ? '编辑' : '预览'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {saved ? '已保存' : '保存'}
          </button>
        </div>
      </div>

      {/* Calendar */}
      <Calendar
        year={viewYear}
        month={viewMonth}
        selectedDate={date}
        datesWithReports={datesWithReports}
        onSelectDate={handleSelectDate}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
      />

      {/* Editor / Preview */}
      <div className="animate-fade-up stagger-3">
        {preview ? (
          <MarkdownPreview content={content} />
        ) : (
          <MarkdownEditor value={content} onChange={setContent} />
        )}
      </div>
    </div>
  )
}
