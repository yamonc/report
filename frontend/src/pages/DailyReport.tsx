import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Save, Loader2, Eye, Edit3, Trash2, LayoutTemplate, Download, Upload, X } from 'lucide-react'
import Calendar from '../components/Calendar'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import TemplateManager from '../components/TemplateManager'
import { api } from '../lib/api'
import { getToday, formatDate } from '../lib/utils'
import { useToast } from '../components/Toast'
import type { Template } from '../types'

export default function DailyReportPage() {
  const { date: paramDate } = useParams<{ date?: string }>()
  const navigate = useNavigate()
  const displayDate = paramDate || getToday()
  const [date, setDate] = useState(displayDate)
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [preview, setPreview] = useState(false)
  const [datesWithReports, setDatesWithReports] = useState<Set<string>>(new Set())
  const [showTemplateManager, setShowTemplateManager] = useState(false)
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const d = new Date(date)
  const [viewYear, setViewYear] = useState(d.getFullYear())
  const [viewMonth, setViewMonth] = useState(d.getMonth() + 1)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportYear, setExportYear] = useState(d.getFullYear())
  const [exportMonth, setExportMonth] = useState(d.getMonth() + 1)

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

  // Load templates for the quick-dropdown
  useEffect(() => {
    api.listTemplates().then(data => setTemplates(data || [])).catch(() => {})
  }, [showTemplateManager])

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
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!content || content.trim() === '') return
    const ok = await toast.confirm('确定要清空当天的日报内容吗？此操作不可撤销。')
    if (!ok) return
    setResetting(true)
    try {
      await api.deleteDailyReport(date)
      setContent('')
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('清空失败')
    } finally {
      setResetting(false)
    }
  }

  // Ctrl+S shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [content, date])

  // Export handler
  const handleExport = async () => {
    setExporting(true)
    try {
      const m = String(exportMonth).padStart(2, '0')
      const lastDay = new Date(exportYear, exportMonth, 0).getDate()
      const monthStart = `${exportYear}-${m}-01`
      const monthEnd = `${exportYear}-${m}-${String(lastDay).padStart(2, '0')}`
      const md = await api.exportDailyReports(monthStart, monthEnd)

      // Download file
      const blob = new Blob([md], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${exportYear}年${exportMonth}月日报.md`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('导出成功')
      setShowExportModal(false)
    } catch {
      toast.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // Open export modal with current month as default
  const openExportModal = () => {
    setExportYear(viewYear)
    setExportMonth(viewMonth)
    setShowExportModal(true)
  }

  // Import handler
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      const year = viewYear // Use current view year
      const result = await api.importDailyReports(text, year)
      toast.success(`成功导入 ${result.count} 条日报`)
      fetchMonthReports()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '导入失败')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleInsertTemplate = (t: Template) => {
    const inserted = t.fields.map(f => `## ${f}\n\n`).join('')
    setContent(prev => prev ? prev + '\n\n' + inserted : inserted)
    setActiveTemplateId(t.id)
  }

  const goToToday = () => navigate('/daily')

  const activeName = templates.find(t => t.id === activeTemplateId)?.name

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
          {/* Import/Export buttons */}
          <button
            onClick={openExportModal}
            disabled={exporting}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-200 disabled:opacity-40"
            type="button"
            title="导出日报为 Markdown"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            导出
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            onChange={handleImport}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-surface transition-all duration-200 disabled:opacity-40"
            type="button"
            title="导入 Markdown 日报"
          >
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            导入
          </button>
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
            onClick={handleReset}
            disabled={resetting || !content}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
            type="button"
            title="清空当天日报内容"
          >
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            清空
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

      {/* Template bar */}
      <div className="animate-fade-up stagger-2 flex items-center gap-3">
        <button
          onClick={() => setShowTemplateManager(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-bg-elevated px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-accent hover:border-accent/30 transition-all duration-200"
          type="button"
        >
          <LayoutTemplate className="h-4 w-4" />
          {activeTemplateId && activeName ? activeName : '选择模板...'}
        </button>

        {activeTemplateId && (
          <span className="text-xs text-text-tertiary">
            模板已插入，可直接编辑每个区域
          </span>
        )}
      </div>

      {/* Editor / Preview */}
      <div className="animate-fade-up stagger-3">
        {preview ? (
          <MarkdownPreview content={content} />
        ) : (
          <MarkdownEditor value={content} onChange={setContent} />
        )}
      </div>

      {/* Template Manager Modal */}
      {showTemplateManager && (
        <TemplateManager
          onClose={() => setShowTemplateManager(false)}
          onInsert={handleInsertTemplate}
          showInsert
        />
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-up">
          <div className="bg-bg-elevated rounded-xl shadow-xl border border-border p-6 w-80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-text-primary">导出日报</h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-text-tertiary hover:text-text-secondary transition-colors"
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm text-text-secondary mb-1">年份</label>
                  <select
                    value={exportYear}
                    onChange={(e) => setExportYear(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {Array.from({ length: 10 }, (_, i) => viewYear - 5 + i).map((y) => (
                      <option key={y} value={y}>{y}年</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm text-text-secondary mb-1">月份</label>
                  <select
                    value={exportMonth}
                    onChange={(e) => setExportMonth(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>{m}月</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft disabled:opacity-40"
                type="button"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                导出 {exportYear}年{exportMonth}月日报
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
