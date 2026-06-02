import { useEffect, useState } from 'react'
import { Plus, Search, Trash2, Link, Code, FileText, Tag } from 'lucide-react'
import { api } from '../lib/api'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import { useToast } from '../components/Toast'
import type { KnowledgeItem } from '../types'

const TYPES = [
  { key: 'note', label: '笔记', icon: FileText },
  { key: 'link', label: '链接', icon: Link },
  { key: 'snippet', label: '代码', icon: Code },
] as const

interface FormData {
  title: string
  type: KnowledgeItem['type']
  content: string
  source_url: string
  tags: string
}

const emptyForm: FormData = {
  title: '',
  type: 'note',
  content: '',
  source_url: '',
  tags: '',
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<KnowledgeItem | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  // All unique tags
  const allTags = [...new Set(items.flatMap((item) => item.tags))].sort()

  useEffect(() => { loadItems() }, [])

  async function loadItems(params?: { search?: string; type?: string; tag?: string }) {
    try {
      const data = await api.listKnowledge(params)
      setItems(data || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  function handleSearch() {
    setLoading(true)
    loadItems({
      search: search || undefined,
      type: typeFilter || undefined,
      tag: tagFilter || undefined,
    })
  }

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  function openEdit(item: KnowledgeItem) {
    setEditing(item)
    setForm({
      title: item.title,
      type: item.type,
      content: item.content,
      source_url: item.source_url,
      tags: item.tags.join(', '),
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
    const payload = {
      ...form,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
    if (editing) {
      await api.updateKnowledge(editing.id, payload)
    } else {
      await api.createKnowledge(payload)
    }
    closeModal()
    loadItems()
  }

  async function handleDelete(id: string) {
    const ok = await toast.confirm('确定删除该知识片段？')
    if (!ok) return
    await api.deleteKnowledge(id)
    loadItems()
  }

  const typeIcon = (t: string) => {
    const def = TYPES.find((x) => x.key === t)
    if (!def) return <FileText className="h-4 w-4 text-text-tertiary" />
    const Icon = def.icon
    return <Icon className="h-4 w-4 text-text-tertiary" />
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-9 w-24" />
        <div className="skeleton h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-32 rounded-xl" />
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
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">知识片段</h1>
          <p className="mt-1.5 text-sm text-text-secondary">{items.length} 条记录</p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:bg-accent-soft"
        >
          <Plus className="h-4 w-4" />
          新建片段
        </button>
      </div>

      {/* Search / Filters */}
      <div className="animate-fade-up stagger-1 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="搜索标题或内容..."
            className="w-full rounded-xl border border-border bg-bg-elevated pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); loadItems({ search: search || undefined, type: e.target.value || undefined, tag: tagFilter || undefined }) }}
          className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5 text-sm text-text-primary focus:border-border-focus transition-all"
        >
          <option value="">所有类型</option>
          {TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="h-3.5 w-3.5 text-text-tertiary" />
            <button
              onClick={() => { setTagFilter(''); loadItems({ search: search || undefined, type: typeFilter || undefined }) }}
              className={`rounded-lg px-2.5 py-1 text-xs transition-all ${tagFilter === '' ? 'bg-accent-subtle text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
            >
              全部
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => { setTagFilter(tag); loadItems({ search: search || undefined, type: typeFilter || undefined, tag }) }}
                className={`rounded-lg px-2.5 py-1 text-xs transition-all ${tagFilter === tag ? 'bg-accent-subtle text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((item, i) => (
          <div
            key={item.id}
            onClick={() => openEdit(item)}
            className={`group animate-fade-up stagger-${Math.min(i + 1, 6)} cursor-pointer rounded-xl border border-border bg-bg-elevated p-5 transition-all duration-200 hover:shadow-sm hover:border-border-visible`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0">
                  {typeIcon(item.type)}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary leading-snug truncate">{item.title}</h3>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-accent hover:underline truncate block mt-0.5"
                    >
                      {item.source_url}
                    </a>
                  )}
                  {item.content && (
                    <p className="mt-1.5 text-xs text-text-tertiary line-clamp-2 leading-relaxed">
                      {item.content.replace(/[#*`>\[\]()\n]/g, ' ').substring(0, 120)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(item.id) }}
                className="shrink-0 p-1 rounded-md text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {item.tags.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded-md bg-bg-hover px-2 py-0.5 text-[11px] text-text-tertiary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-3 text-[11px] text-text-tertiary">
              {new Date(item.created_at).toLocaleDateString('zh-CN')}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <p className="text-text-tertiary text-sm">暂无知识片段</p>
            <button
              onClick={openCreate}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-soft transition-colors"
            >
              <Plus className="h-4 w-4" />
              创建第一条知识
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
            {/* Modal header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
              <h2 className="font-serif text-lg font-semibold text-text-primary">
                {editing ? '编辑知识' : '新建知识'}
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
                  placeholder="知识标题"
                  className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                />
              </div>

              {/* Type + Source URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">类型</label>
                  <div className="flex gap-1.5">
                    {TYPES.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setForm({ ...form, type: t.key })}
                        className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                          form.type === t.key
                            ? 'bg-accent-subtle text-accent border border-accent/20'
                            : 'border border-border text-text-tertiary hover:text-text-secondary hover:border-border-visible'
                        }`}
                      >
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-1.5">来源链接（可选）</label>
                  <input
                    type="url"
                    value={form.source_url}
                    onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="例如：Go, React, 最佳实践"
                  className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                />
              </div>

              {/* Content */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-text-secondary">内容</label>
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
                    <MarkdownPreview content={form.content || '*暂无内容*'} />
                  </div>
                ) : (
                  <MarkdownEditor
                    value={form.content}
                    onChange={(v) => setForm({ ...form, content: v })}
                    placeholder="内容（支持 Markdown）"
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
