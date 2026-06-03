import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react'
import { api } from '../lib/api'
import { useToast } from './Toast'
import type { Template } from '../types'

type Mode = 'list' | 'create' | 'edit'

interface TemplateManagerProps {
  onClose: () => void
  onInsert?: (template: Template) => void
  showInsert?: boolean
}

export default function TemplateManager({ onClose, onInsert, showInsert }: TemplateManagerProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<Mode>('list')
  const [editTarget, setEditTarget] = useState<Template | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [fieldsText, setFieldsText] = useState('')
  const toast = useToast()

  useEffect(() => { loadTemplates() }, [])

  async function loadTemplates() {
    try {
      const data = await api.listTemplates()
      setTemplates(data || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }

  function openCreate() {
    setMode('create')
    setEditTarget(null)
    setName('')
    setFieldsText('')
  }

  function openEdit(t: Template) {
    setMode('edit')
    setEditTarget(t)
    setName(t.name)
    setFieldsText(t.fields.join('\n'))
  }

  function goToList() {
    setMode('list')
    setEditTarget(null)
    setName('')
    setFieldsText('')
  }

  async function handleSave() {
    if (!name.trim()) return
    const fields = fieldsText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    if (fields.length === 0) {
      toast.error('至少需要一个字段')
      return
    }

    setSaving(true)
    try {
      if (mode === 'edit' && editTarget) {
        await api.updateTemplate(editTarget.id, { name: name.trim(), fields })
      } else {
        await api.createTemplate({ name: name.trim(), fields })
      }
      goToList()
      await loadTemplates()
    } catch (err: any) {
      toast.error(err.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await toast.confirm('确定删除该模板？')
    if (!ok) return
    try {
      await api.deleteTemplate(id)
      await loadTemplates()
    } catch {
      toast.error('删除失败')
    }
  }

  function handleInsert(t: Template) {
    onInsert?.(t)
    onClose()
  }

  const headerTitle = mode === 'edit' ? '编辑模板' : mode === 'create' ? '新建模板' : '管理模板'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] bg-black/20 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-6 py-4">
          <h2 className="font-serif text-lg font-semibold text-text-primary">{headerTitle}</h2>
          <button
            onClick={mode === 'list' ? onClose : goToList}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
            </div>
          ) : mode !== 'list' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">模板名称</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如：标准日报"
                  className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  字段列表（每行一个）
                </label>
                <textarea
                  value={fieldsText}
                  onChange={e => setFieldsText(e.target.value)}
                  placeholder={"今日完成\n明日计划\n遇到的问题"}
                  rows={6}
                  className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all resize-none"
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  每个字段将作为 Markdown 二级标题（## 字段名）插入到编辑器中
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={goToList}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                  type="button"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !name.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-[#1a1a16] hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  type="button"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  保存
                </button>
              </div>
            </div>
          ) : (
            <>
              {templates.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm text-text-tertiary">暂无模板</p>
                  <p className="text-xs text-text-tertiary/50 mt-1">
                    创建一个模板，日报填写时一键插入结构化标题
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map(t => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-xl border border-border-subtle bg-bg-surface/50 px-4 py-3.5 group hover:border-border-visible transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-text-primary">{t.name}</h4>
                        <p className="text-xs text-text-tertiary mt-0.5 flex flex-wrap gap-1">
                          {t.fields.map((f, i) => (
                            <span key={f}>
                              <code className="text-[10px] bg-bg-hover px-1.5 py-0.5 rounded font-sans">{f}</code>
                              {i < t.fields.length - 1 && ' · '}
                            </span>
                          ))}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {showInsert && (
                          <button
                            onClick={() => handleInsert(t)}
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent-subtle transition-all"
                            type="button"
                          >
                            插入
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(t)}
                          className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
                          type="button"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="rounded-lg p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-all"
                          type="button"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={openCreate}
                className="w-full rounded-xl border border-dashed border-border py-3 text-sm text-text-tertiary hover:text-accent hover:border-accent/30 transition-all"
                type="button"
              >
                <Plus className="inline h-4 w-4 mr-1.5" />
                新建模板
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
