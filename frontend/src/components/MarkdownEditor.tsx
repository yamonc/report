import { Bold, Italic, List, Code } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: string
}

export default function MarkdownEditor({ value, onChange, placeholder, minHeight = '400px' }: Props) {
  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('md-editor') as HTMLTextAreaElement
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end)
    const newText = value.substring(0, start) + prefix + selected + (suffix || prefix) + value.substring(end)
    onChange(newText)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + selected.length
      )
    }, 0)
  }

  return (
    <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden transition-all duration-200 focus-within:border-border-focus">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 border-b border-border-subtle px-3 py-2">
        <button
          onClick={() => insertMarkdown('**', '**')}
          className="rounded-md p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-150"
          title="加粗"
          type="button"
        >
          <Bold className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => insertMarkdown('*', '*')}
          className="rounded-md p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-150"
          title="斜体"
          type="button"
        >
          <Italic className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => insertMarkdown('\n- ')}
          className="rounded-md p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-150"
          title="列表"
          type="button"
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => insertMarkdown('`', '`')}
          className="rounded-md p-2 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all duration-150"
          title="代码"
          type="button"
        >
          <Code className="h-3.5 w-3.5" />
        </button>
        <div className="ml-auto text-xs text-text-tertiary font-mono tracking-tight">
          Markdown
        </div>
      </div>

      {/* Textarea */}
      <textarea
        id="md-editor"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '开始写日报...'}
        className="w-full resize-none bg-transparent px-4 py-3.5 text-sm leading-relaxed text-text-primary outline-none placeholder:text-text-tertiary/50"
        style={{ minHeight, fontFamily: "var(--font-mono)" }}
      />
    </div>
  )
}
