import { useEffect, useState } from 'react'
import { Sparkles, Loader2, Pencil, Check, ChevronLeft, ChevronRight, FileText, Edit3, X } from 'lucide-react'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import { api } from '../lib/api'
import { getWeekStart, getWeekEnd, getWeekLabel } from '../lib/utils'
import { useToast } from '../components/Toast'
import type { WeeklyReport as WeeklyReportType } from '../types'

export default function WeeklyReportPage() {
  const [weekStart, setWeekStart] = useState(getWeekStart())
  const [weekEnd, setWeekEnd] = useState(getWeekEnd())
  const [report, setReport] = useState<WeeklyReportType | null>(null)
  const [content, setContent] = useState('')
  const [editing, setEditing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState<WeeklyReportType[]>([])
  const toast = useToast()

  const reportId = `${weekStart}_${weekEnd}`

  useEffect(() => {
    loadReport()
    loadHistory()
  }, [weekStart, weekEnd])

  const loadReport = async () => {
    try {
      const r = await api.getWeeklyReport(reportId)
      setReport(r)
      setContent(r.content)
    } catch {
      setReport(null)
      setContent('')
    }
  }

  const loadHistory = () => {
    api.listWeeklyReports().then(setHistory).catch(() => {})
  }

  const changeWeek = (weeks: number) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + weeks * 7)
    const ws = getWeekStart(d)
    const we = getWeekEnd(d)
    setWeekStart(ws)
    setWeekEnd(we)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const r = await api.generateWeeklyReport(weekStart, weekEnd)
      setReport(r)
      setContent(r.content)
      loadHistory()
    } catch (err: any) {
      toast.error(err.message || '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async () => {
    if (!report) return
    setSaving(true)
    try {
      const updated = await api.updateWeeklyReport(report.id, { content })
      setReport(updated)
      setEditing(false)
      loadHistory()
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleConfirm = async () => {
    if (!report) return
    setSaving(true)
    try {
      const updated = await api.updateWeeklyReport(report.id, {
        content,
        status: 'confirmed',
      })
      setReport(updated)
      setEditing(false)
      loadHistory()
    } catch {
      toast.error('确认失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">周报</h1>
        <p className="mt-1.5 text-text-secondary text-sm">
          由 AI 根据一周日报自动生成，支持编辑后确认保存。
        </p>
      </div>

      {/* Week picker bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-bg-elevated p-4 animate-fade-up stagger-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => changeWeek(-1)}
            className="rounded-lg p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[220px] text-center text-sm font-medium text-text-primary font-mono tracking-tight">
            {getWeekLabel(weekStart, weekEnd)}
          </span>
          <button
            onClick={() => changeWeek(1)}
            className="rounded-lg p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <input
          type="date"
          value={weekStart}
          onChange={(e) => {
            const ws = e.target.value
            const d = new Date(ws)
            d.setDate(d.getDate() + 6)
            setWeekStart(ws)
            setWeekEnd(d.toISOString().slice(0, 10))
          }}
          className="rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary outline-none focus:border-border-focus transition-colors"
        />

        <div className="flex items-center gap-2">
          {report && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                report.status === 'confirmed'
                  ? 'bg-success-bg text-success'
                  : 'bg-info-bg text-info'
              }`}
            >
              {report.status === 'confirmed' ? '已确认' : '草稿'}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {!report && (
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_var(--accent-glow)]"
              type="button"
            >
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI 生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  AI 生成周报
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Report content */}
      {report && (
        <div className="animate-fade-up stagger-2">
          {editing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setEditing(false); setContent(report.content) }}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all duration-200"
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                  保存修改
                </button>
              </div>
              <MarkdownEditor value={content} onChange={setContent} minHeight="500px" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:text-text-primary hover:border-border-visible hover:bg-bg-hover"
                  type="button"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  编辑
                </button>
                {report.status !== 'confirmed' && (
                  <button
                    onClick={handleConfirm}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-sm font-medium text-[#1a1a16] transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    type="button"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    确认周报
                  </button>
                )}
              </div>
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <div className="animate-fade-up stagger-3">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-text-tertiary">历史周报</h3>
          <div className="space-y-1.5">
            {history.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setWeekStart(r.week_start)
                  setWeekEnd(r.week_end)
                }}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-all duration-200 ${
                  r.id === reportId
                    ? 'border-accent/30 bg-accent-subtle'
                    : 'border-border-subtle bg-transparent hover:border-border hover:bg-bg-surface/50'
                }`}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className={`h-4 w-4 ${r.id === reportId ? 'text-accent' : 'text-text-tertiary'}`} />
                    <span className={`text-sm font-medium ${r.id === reportId ? 'text-accent' : 'text-text-secondary'}`}>
                      {getWeekLabel(r.week_start, r.week_end)}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.status === 'confirmed'
                        ? 'bg-success-bg text-success'
                        : 'bg-info-bg text-info'
                    }`}
                  >
                    {r.status === 'confirmed' ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                    {r.status === 'confirmed' ? '已确认' : '草稿'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
