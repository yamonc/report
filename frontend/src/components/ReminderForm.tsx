import { useState } from 'react'
import { X } from 'lucide-react'
import type { ReminderTask } from '../types'

interface Props {
  task: ReminderTask | null
  onSave: (data: Partial<ReminderTask>) => void
  onClose: () => void
}

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function ReminderForm({ task, onSave, onClose }: Props) {
  const [name, setName] = useState(task?.name || '')
  const [scheduleType, setScheduleType] = useState<'daily' | 'weekly'>(task?.schedule_type || 'daily')
  const [time, setTime] = useState(task?.time || '18:00')
  const [weekday, setWeekday] = useState(task?.weekday ?? 5)
  const [message, setMessage] = useState(task?.message || '')
  const [enabled] = useState(task?.enabled ?? true)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('名称不能为空'); return }
    if (!message.trim()) { setError('提醒内容不能为空'); return }
    if (!time) { setError('时间不能为空'); return }
    onSave({ name: name.trim(), schedule_type: scheduleType, time, weekday, message: message.trim(), enabled })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-xl border border-border bg-bg-elevated shadow-xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <h3 className="font-serif text-base font-semibold text-text-primary">
            {task ? '编辑提醒' : '添加提醒'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：填写日报、喝水提醒"
              className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus placeholder:text-text-tertiary/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">类型</label>
              <select
                value={scheduleType}
                onChange={(e) => setScheduleType(e.target.value as 'daily' | 'weekly')}
                className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus cursor-pointer"
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">时间</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus"
              />
            </div>
          </div>

          {scheduleType === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">星期几</label>
              <select
                value={weekday}
                onChange={(e) => setWeekday(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus cursor-pointer"
              >
                {weekdays.map((label, i) => (
                  <option key={i} value={i}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">提醒内容</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="提醒邮件中显示的正文内容"
              className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-border-focus placeholder:text-text-tertiary/50 resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-bg-hover transition-all"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
