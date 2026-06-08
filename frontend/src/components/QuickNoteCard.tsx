import { Archive, Pencil, Trash2 } from 'lucide-react'
import type { QuickNote, SearchResultItem } from '../types'

interface QuickNoteCardProps {
  note: QuickNote
  searchResult?: SearchResultItem
  onEdit: (note: QuickNote) => void
  onDelete: (id: string) => void
  onArchive: (note: QuickNote) => void
}

export default function QuickNoteCard({ note, searchResult, onEdit, onDelete, onArchive }: QuickNoteCardProps) {
  const contentLines = note.content.split('\n')
  const preview = contentLines.slice(0, 3).join('\n') + (contentLines.length > 3 ? '\n...' : '')

  return (
    <div className="group rounded-xl border border-border bg-bg-elevated p-4 transition-all duration-200 hover:shadow-sm hover:border-border-visible animate-fade-up">
      {/* Content preview */}
      <div className="min-w-0">
        {searchResult?.match_reason && (
          <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-0.5 text-[11px] text-accent">
            匹配: {searchResult.match_reason} · 相关度 {searchResult.score}/10
          </div>
        )}
        <p className="text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
          {preview}
        </p>
      </div>

      {/* Tags + Actions */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 flex-wrap">
          {note.tags.map((tag) => (
            <span key={tag} className="inline-flex items-center rounded-md bg-bg-hover px-2 py-0.5 text-[11px] text-text-tertiary">
              {tag}
            </span>
          ))}
          <span className="text-[11px] text-text-tertiary ml-1">
            {new Date(note.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            onClick={() => onArchive(note)}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-accent hover:bg-accent-subtle transition-all"
            title="归档到知识库"
          >
            <Archive className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onEdit(note)}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(note.id)}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-red-500 hover:bg-red-50 transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
