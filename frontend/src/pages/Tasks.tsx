import { useEffect, useState } from 'react'
import { Plus, Trash2, AlertCircle, Clock } from 'lucide-react'
import { api } from '../lib/api'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import type { Task } from '../types'

const STATUSES = [
  { key: 'todo', label: '待处理' },
  { key: 'doing', label: '进行中' },
  { key: 'done', label: '已完成' },
] as const

const PRIORITIES = [
  { key: 'high', label: '高' },
  { key: 'medium', label: '中' },
  { key: 'low', label: '低' },
] as const

const CATEGORIES = ['开发', '设计', '文档', '其他']

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-warning-bg text-warning',
  low: 'bg-bg-hover text-text-tertiary',
}

const PRIORITY_BORDER: Record<string, string> = {
  high: 'border-l-red-400',
  medium: 'border-l-accent',
  low: 'border-l-transparent',
}

interface FormData {
  title: string
  description: string
  status: string
  priority: string
  category: string
  due_date: string
}

const emptyForm: FormData = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: '其他',
  due_date: '',
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [previewId, setPreviewId] = useState<string | null>(null)

  useEffect(() => { loadTasks() }, [])

  async function loadTasks() {
    try {
      const data = await api.listTasks()
      setTasks(data || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  function openCreate(status: string) {
    setEditing(null)
    setForm({ ...emptyForm, status })
    setShowModal(true)
  }

  function openEdit(task: Task) {
    setEditing(task)
    setForm({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      category: task.category,
      due_date: task.due_date,
    })
    setShowModal(true)
  }

  function closeModal() {
    setShowModal(false)
    setEditing(null)
    setForm(emptyForm)
    setPreviewId(null)
  }

  async function handleSubmit() {
    if (!form.title.trim()) return
    if (editing) {
      await api.updateTask(editing.id, form)
    } else {
      await api.createTask(form)
    }
    closeModal()
    loadTasks()
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该任务？')) return
    await api.deleteTask(id)
    loadTasks()
  }

  async function moveTask(id: string, status: string) {
    await api.updateTaskStatus(id, status)
    loadTasks()
  }

  const tasksByStatus = (status: string) => tasks.filter((t) => t.status === status)

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-9 w-24" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-64 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">任务清单</h1>
          <p className="mt-1.5 text-sm text-text-secondary">{tasks.length} 个任务</p>
        </div>
        <button
          onClick={() => openCreate('todo')}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-accent-soft"
        >
          <Plus className="h-4 w-4" />
          新建任务
        </button>
      </div>

      {/* Kanban */}
      <div className="grid gap-4 md:grid-cols-3">
        {STATUSES.map(({ key, label }) => (
          <div
            key={key}
            className="animate-fade-up rounded-xl border border-border-subtle bg-bg-elevated p-4 min-h-[300px]"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
              <span className="text-xs text-text-tertiary">{tasksByStatus(key).length}</span>
            </div>
            <div className="space-y-3">
              {tasksByStatus(key).map((task) => (
                <div
                  key={task.id}
                  onClick={() => openEdit(task)}
                  className={`group cursor-pointer rounded-lg border border-border bg-bg-elevated p-3.5 transition-all duration-200 hover:shadow-sm hover:border-border-visible border-l-[3px] ${PRIORITY_BORDER[task.priority]}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-text-primary leading-snug">{task.title}</h3>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                      className="shrink-0 p-1 rounded-md text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_COLORS[task.priority]}`}>
                      {PRIORITIES.find((p) => p.key === task.priority)?.label}
                    </span>
                    <span className="text-[11px] text-text-tertiary">{task.category}</span>
                    {task.due_date && (
                      <span className={`inline-flex items-center gap-1 text-[11px] ${
                        task.due_date < new Date().toISOString().slice(0, 10) && task.status !== 'done'
                          ? 'text-red-500'
                          : 'text-text-tertiary'
                      }`}>
                        <Clock className="h-3 w-3" />
                        {task.due_date}
                      </span>
                    )}
                  </div>
                  {/* Quick status change */}
                  {key !== 'done' && (
                    <div className="mt-2.5 pt-2.5 border-t border-border-subtle flex gap-1.5">
                      {STATUSES.filter((s) => s.key !== key).map((s) => (
                        <button
                          key={s.key}
                          onClick={(e) => { e.stopPropagation(); moveTask(task.id, s.key) }}
                          className="text-[11px] text-text-tertiary hover:text-accent transition-colors"
                        >
                          → {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={() => openCreate(key)}
                className="w-full rounded-lg border border-dashed border-border py-2.5 text-xs text-text-tertiary hover:text-accent hover:border-accent/30 transition-all duration-150"
              >
                <Plus className="inline h-3.5 w-3.5 mr-1" />
                添加
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/20 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
              <h2 className="font-serif text-lg font-semibold text-text-primary">
                {editing ? '编辑任务' : '新建任务'}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all">
                <span className="text-lg leading-none">&times;</span>
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">标题</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="任务标题"
                  className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                />
              </div>

              {/* Meta row */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">状态</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full rounded-xl border border-border bg-bg-root px-3 py-2.5 text-sm text-text-primary focus:border-border-focus transition-all"
                  >
                    {STATUSES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">优先级</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: e.target.value })}
                    className="w-full rounded-xl border border-border bg-bg-root px-3 py-2.5 text-sm text-text-primary focus:border-border-focus transition-all"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.key} value={p.key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">分类</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full rounded-xl border border-border bg-bg-root px-3 py-2.5 text-sm text-text-primary focus:border-border-focus transition-all"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">截止日期</label>
                  <input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    className="w-full rounded-xl border border-border bg-bg-root px-3 py-2.5 text-sm text-text-primary focus:border-border-focus transition-all"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-text-secondary">描述</label>
                  <button
                    type="button"
                    onClick={() => setPreviewId(previewId ? null : 'form')}
                    className="text-xs text-accent hover:text-accent-soft transition-colors"
                  >
                    {previewId === 'form' ? '编辑' : '预览'}
                  </button>
                </div>
                {previewId === 'form' ? (
                  <div className="rounded-xl border border-border bg-bg-elevated p-4 min-h-[200px]">
                    <MarkdownPreview content={form.description || '*暂无内容*'} />
                  </div>
                ) : (
                  <MarkdownEditor
                    value={form.description}
                    onChange={(v) => setForm({ ...form, description: v })}
                    placeholder="任务描述（支持 Markdown）"
                    minHeight="200px"
                  />
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-b-2xl">
              <button
                onClick={closeModal}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!form.title.trim()}
                className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editing ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
