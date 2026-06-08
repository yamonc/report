import { useState } from 'react'

interface QuickNoteFormProps {
  initial?: { content: string; tags: string[] }
  saving?: boolean
  onSave: (data: { content: string; tags: string[] }) => void
  onClose: () => void
}

export default function QuickNoteForm({ initial, saving, onSave, onClose }: QuickNoteFormProps) {
  const [content, setContent] = useState(initial?.content || '')
  const [tags, setTags] = useState(initial?.tags?.join(', ') || '')

  const handleSubmit = () => {
    if (!content.trim()) return
    onSave({
      content: content.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/20 backdrop-blur-sm">
      <div className="w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-bg-elevated shadow-xl animate-fade-up">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-5 py-3.5 rounded-t-2xl">
          <h2 className="font-serif text-lg font-semibold text-text-primary">
            {initial ? '编辑小记' : '新建小记'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
          >
            <span className="text-lg leading-none">&times;</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">内容（支持 Markdown）</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="记录碎片想法、排查笔记..."
              rows={10}
              className="w-full rounded-xl border border-border bg-bg-root px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all resize-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1.5">标签（逗号分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="例如：SLB, 排查, 重定向"
              className="w-full rounded-xl border border-border bg-bg-root px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary/50 focus:border-border-focus transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-border-subtle bg-bg-elevated/95 backdrop-blur-sm px-5 py-3.5 rounded-b-2xl">
          <button
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || saving}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-soft transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
