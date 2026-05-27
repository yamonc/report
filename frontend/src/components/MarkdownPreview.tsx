import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
}

export default function MarkdownPreview({ content }: Props) {
  return (
    <div className="markdown-preview rounded-xl border border-border bg-bg-elevated p-6">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
