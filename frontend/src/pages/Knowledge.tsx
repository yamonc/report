import { useEffect, useState, useCallback } from 'react'
import { Plus, Search, Trash2, Link, Code, FileText, Tag, Archive, Sparkles, Loader2, PenSquare } from 'lucide-react'
import { api } from '../lib/api'
import MarkdownEditor from '../components/MarkdownEditor'
import MarkdownPreview from '../components/MarkdownPreview'
import QuickNoteCard from '../components/QuickNoteCard'
import QuickNoteForm from '../components/QuickNoteForm'
import { useToast } from '../components/Toast'
import type { KnowledgeItem, QuickNote, SearchResultItem } from '../types'

const TYPES = [
  { key: 'note', label: '笔记', icon: FileText },
  { key: 'link', label: '链接', icon: Link },
  { key: 'snippet', label: '代码', icon: Code },
] as const

interface KnowledgeFormData {
  title: string
  type: KnowledgeItem['type']
  content: string
  source_url: string
  tags: string
}

const emptyKnowledgeForm: KnowledgeFormData = {
  title: '',
  type: 'note',
  content: '',
  source_url: '',
  tags: '',
}

type Tab = 'quick-notes' | 'knowledge'

export default function KnowledgePage() {
  const [activeTab, setActiveTab] = useState<Tab>('quick-notes')

  // ===== Quick Notes state =====
  const [notes, setNotes] = useState<QuickNote[]>([])
  const [notesLoading, setNotesLoading] = useState(true)
  const [notesForm, setNotesForm] = useState<QuickNote | null>(null)
  const [showNotesForm, setShowNotesForm] = useState(false)
  const [notesSaving, setNotesSaving] = useState(false)

  const [fastInput, setFastInput] = useState('')

  // AI Search
  const [aiQuery, setAiQuery] = useState('')
  const [aiSearching, setAiSearching] = useState(false)
  const [aiResults, setAiResults] = useState<SearchResultItem[] | null>(null)

  // ===== Knowledge state =====
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItem[]>([])
  const [knowledgeLoading, setKnowledgeLoading] = useState(true)
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false)
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeItem | null>(null)
  const [knowledgeForm, setKnowledgeForm] = useState<KnowledgeFormData>(emptyKnowledgeForm)
  const [previewId, setPreviewId] = useState<string | null>(null)

  // Knowledge filters
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')

  const toast = useToast()

  // Load notes
  const loadNotes = useCallback(async () => {
    try {
      const data = await api.listQuickNotes('active')
      setNotes(data || [])
    } catch { /* ignore */ } finally { setNotesLoading(false) }
  }, [])

  // Load knowledge
  const loadKnowledge = useCallback(async (params?: { search?: string; type?: string; tag?: string }) => {
    try {
      const data = await api.listKnowledge(params)
      setKnowledgeItems(data || [])
    } catch { /* ignore */ } finally { setKnowledgeLoading(false) }
  }, [])

  useEffect(() => { loadNotes() }, [loadNotes])
  useEffect(() => { loadKnowledge() }, [loadKnowledge])

  // ===== Quick Note actions =====
  const handleFastSave = async () => {
    if (!fastInput.trim()) return
    try {
      await api.createQuickNote({ content: fastInput.trim() })
      setFastInput('')
      loadNotes()
    } catch {
      toast.error('保存失败')
    }
  }

  const handleNoteSave = async (data: { content: string; tags: string[] }) => {
    setNotesSaving(true)
    try {
      if (notesForm) {
        await api.updateQuickNote(notesForm.id, data)
      } else {
        await api.createQuickNote(data)
      }
      setShowNotesForm(false)
      setNotesForm(null)
      loadNotes()
    } catch {
      toast.error('保存失败')
    } finally {
      setNotesSaving(false)
    }
  }

  const handleDeleteNote = async (id: string) => {
    const ok = await toast.confirm('确定删除该小记？')
    if (!ok) return
    try {
      await api.deleteQuickNote(id)
      loadNotes()
    } catch {
      toast.error('删除失败')
    }
  }

  const handleAISearch = async () => {
    if (!aiQuery.trim()) return
    setAiSearching(true)
    setAiResults(null)
    try {
      const data = await api.searchQuickNotes(aiQuery.trim())
      setAiResults(data)
      if (data.length === 0) {
        toast.error('未找到匹配的小记')
      }
    } catch (err: any) {
      toast.error(err.message || '搜索失败')
    } finally {
      setAiSearching(false)
    }
  }

  const handleArchive = async (note: QuickNote) => {
    try {
      const firstLine = note.content.split('\n')[0].trim().substring(0, 80) || '未命名'
      await api.archiveQuickNote(note.id, { title: firstLine })
      toast.success(`「${firstLine}」已归档到知识库`)
      loadNotes()
      loadKnowledge()
    } catch (err: any) {
      toast.error(err.message || '归档失败')
    }
  }

  const toggleAISearch = () => {
    if (aiResults !== null) {
      setAiResults(null)
      setAiQuery('')
    }
  }

  // ===== Knowledge actions =====
  const openCreateKnowledge = () => {
    setEditingKnowledge(null)
    setKnowledgeForm(emptyKnowledgeForm)
    setShowKnowledgeModal(true)
  }

  const openEditKnowledge = (item: KnowledgeItem) => {
    setEditingKnowledge(item)
    setKnowledgeForm({
      title: item.title,
      type: item.type,
      content: item.content,
      source_url: item.source_url,
      tags: item.tags.join(', '),
    })
    setShowKnowledgeModal(true)
  }

  const closeKnowledgeModal = () => {
    setShowKnowledgeModal(false)
    setEditingKnowledge(null)
    setKnowledgeForm(emptyKnowledgeForm)
    setPreviewId(null)
  }

  const handleKnowledgeSubmit = async () => {
    if (!knowledgeForm.title.trim()) return
    const payload = {
      ...knowledgeForm,
      tags: knowledgeForm.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }
    if (editingKnowledge) {
      await api.updateKnowledge(editingKnowledge.id, payload)
    } else {
      await api.createKnowledge(payload)
    }
    closeKnowledgeModal()
    loadKnowledge()
  }

  const handleDeleteKnowledge = async (id: string) => {
    const ok = await toast.confirm('确定删除该知识片段？')
    if (!ok) return
    await api.deleteKnowledge(id)
    loadKnowledge()
  }

  // ===== Shared helpers =====
  const typeIcon = (t: string) => {
    const def = TYPES.find((x) => x.key === t)
    if (!def) return <FileText className="h-4 w-4 text-text-tertiary" />
    const Icon = def.icon
    return <Icon className="h-4 w-4 text-text-tertiary" />
  }

  const allTags = [...new Set(knowledgeItems.flatMap((item) => item.tags))].sort()

  const handleKnowledgeSearch = () => {
    setKnowledgeLoading(true)
    loadKnowledge({
      search: search || undefined,
      type: typeFilter || undefined,
      tag: tagFilter || undefined,
    })
  }

  // ===== RENDER =====
  return (
    <div className="space-y-8">
      {/* Header + Tabs */}
      <div className="animate-fade-up">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">知识管理</h1>
        </div>

        {/* Tab switcher */}
        <div className="mt-4 inline-flex rounded-xl border border-border p-1 bg-bg-elevated">
          <button
            onClick={() => setActiveTab('quick-notes')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'quick-notes'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <PenSquare className="h-4 w-4" />
            小记
            {notes.length > 0 && (
              <span className={`text-xs ${activeTab === 'quick-notes' ? 'text-white/70' : 'text-text-tertiary'}`}>
                {notes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('knowledge')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === 'knowledge'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <FileText className="h-4 w-4" />
            知识库
          </button>
        </div>
      </div>

      {/* ===== QUICK NOTES TAB ===== */}
      {activeTab === 'quick-notes' && (
        <div className="space-y-6">
          {/* AI Search bar */}
          <div className="animate-fade-up stagger-1">
            <div className="relative flex gap-2">
              <div className="relative flex-1">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-accent" />
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
                  placeholder="AI 智能搜索，输入自然语言查找相关小记..."
                  className="w-full rounded-xl border border-accent/20 bg-bg-elevated pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-accent transition-all"
                />
              </div>
              <button
                onClick={handleAISearch}
                disabled={aiSearching || !aiQuery.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                {aiSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {aiSearching ? '搜索中...' : 'AI 搜索'}
              </button>
            </div>

            {/* AI results banner */}
            {aiResults !== null && aiResults.length > 0 && (
              <div className="mt-3 mb-1 text-xs text-text-tertiary">
                AI 找到 {aiResults.length} 条相关小记
                <button onClick={toggleAISearch} className="ml-2 text-accent hover:underline">清除</button>
              </div>
            )}
          </div>

          {/* Fast input */}
          <div className="animate-fade-up stagger-1">
            <div className="flex gap-2 items-start">
              <textarea
                value={fastInput}
                onChange={(e) => setFastInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                    e.preventDefault()
                    handleFastSave()
                  }
                }}
                placeholder="快速记录...（Enter 保存，Ctrl+Enter 换行）"
                rows={2}
                className="flex-1 rounded-xl border border-border bg-bg-elevated px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all resize-none"
              />
              <button
                onClick={() => setShowNotesForm(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                title="打开完整编辑器"
              >
                <Plus className="h-4 w-4" />
                新建
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
          ) : (aiResults !== null ? aiResults : notes).length === 0 ? (
            <div className="py-16 text-center animate-fade-up">
              <PenSquare className="h-10 w-10 text-text-tertiary/40 mx-auto mb-3" />
              <p className="text-text-tertiary text-sm">
                {aiResults !== null ? 'AI 未找到匹配的小记' : '暂无小记，在上方输入框快速记录'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(aiResults !== null
                ? aiResults.map((r) => {
                    const note = notes.find((n) => n.id === r.id)
                    if (!note) return null
                    return (
                      <div key={r.id} className="animate-fade-up">
                        <QuickNoteCard
                          note={note}
                          searchResult={r}
                          onEdit={(n) => { setNotesForm(n); setShowNotesForm(true) }}
                          onDelete={handleDeleteNote}
                          onArchive={handleArchive}
                        />
                      </div>
                    )
                  }).filter(Boolean)
                : notes.map((note, i) => (
                    <div key={note.id} className={`animate-fade-up stagger-${Math.min(i + 1, 6)}`}>
                      <QuickNoteCard
                        note={note}
                        onEdit={(n) => { setNotesForm(n); setShowNotesForm(true) }}
                        onDelete={handleDeleteNote}
                        onArchive={handleArchive}
                      />
                    </div>
                  ))
              )}
            </div>
          )}

          {/* QuickNote form modal */}
          {showNotesForm && (
            <QuickNoteForm
              initial={notesForm ? { content: notesForm.content, tags: notesForm.tags } : undefined}
              saving={notesSaving}
              onSave={handleNoteSave}
              onClose={() => { setShowNotesForm(false); setNotesForm(null) }}
            />
          )}
        </div>
      )}

      {/* ===== KNOWLEDGE TAB ===== */}
      {activeTab === 'knowledge' && (
        <div className="space-y-8">
          {/* Header */}
          <div className="animate-fade-up flex items-center justify-between">
            <p className="text-sm text-text-secondary">{knowledgeItems.length} 条记录</p>
            <button
              onClick={openCreateKnowledge}
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
                onKeyDown={(e) => e.key === 'Enter' && handleKnowledgeSearch()}
                placeholder="搜索标题或内容..."
                className="w-full rounded-xl border border-border bg-bg-elevated pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value)
                loadKnowledge({ search: search || undefined, type: e.target.value || undefined, tag: tagFilter || undefined })
              }}
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
                  onClick={() => { setTagFilter(''); loadKnowledge({ search: search || undefined, type: typeFilter || undefined }) }}
                  className={`rounded-lg px-2.5 py-1 text-xs transition-all ${tagFilter === '' ? 'bg-accent-subtle text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
                >
                  全部
                </button>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setTagFilter(tag); loadKnowledge({ search: search || undefined, type: typeFilter || undefined, tag }) }}
                    className={`rounded-lg px-2.5 py-1 text-xs transition-all ${tagFilter === tag ? 'bg-accent-subtle text-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Knowledge list */}
          {knowledgeLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {knowledgeItems.map((item, i) => (
                <div
                  key={item.id}
                  onClick={() => openEditKnowledge(item)}
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
                      onClick={(e) => { e.stopPropagation(); handleDeleteKnowledge(item.id) }}
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
              {knowledgeItems.length === 0 && (
                <div className="col-span-full py-16 text-center">
                  <p className="text-text-tertiary text-sm">暂无知识片段</p>
                  <button
                    onClick={openCreateKnowledge}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-soft transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    创建第一条知识
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Knowledge modal */}
          {showKnowledgeModal && (
            <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] bg-black/20 backdrop-blur-sm">
              <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-t-2xl">
                  <h2 className="font-serif text-lg font-semibold text-text-primary">
                    {editingKnowledge ? '编辑知识' : '新建知识'}
                  </h2>
                  <button onClick={closeKnowledgeModal} className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all">
                    <span className="text-lg leading-none">&times;</span>
                  </button>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">标题</label>
                    <input
                      type="text"
                      value={knowledgeForm.title}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, title: e.target.value })}
                      placeholder="知识标题"
                      className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1.5">类型</label>
                      <div className="flex gap-1.5">
                        {TYPES.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            onClick={() => setKnowledgeForm({ ...knowledgeForm, type: t.key })}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                              knowledgeForm.type === t.key
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
                        value={knowledgeForm.source_url}
                        onChange={(e) => setKnowledgeForm({ ...knowledgeForm, source_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1.5">标签（逗号分隔）</label>
                    <input
                      type="text"
                      value={knowledgeForm.tags}
                      onChange={(e) => setKnowledgeForm({ ...knowledgeForm, tags: e.target.value })}
                      placeholder="例如：Go, React, 最佳实践"
                      className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
                    />
                  </div>
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
                        <MarkdownPreview content={knowledgeForm.content || '*暂无内容*'} />
                      </div>
                    ) : (
                      <MarkdownEditor
                        value={knowledgeForm.content}
                        onChange={(v) => setKnowledgeForm({ ...knowledgeForm, content: v })}
                        placeholder="内容（支持 Markdown）"
                        minHeight="200px"
                      />
                    )}
                  </div>
                </div>
                <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-6 py-4 rounded-b-2xl">
                  <button
                    onClick={closeKnowledgeModal}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleKnowledgeSubmit}
                    disabled={!knowledgeForm.title.trim()}
                    className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {editingKnowledge ? '保存' : '创建'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
