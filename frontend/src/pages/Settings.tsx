import { useEffect, useState } from 'react'
import { Save, Loader2, Eye, EyeOff, Server, Mail, Bell, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Send } from 'lucide-react'
import { api } from '../lib/api'
import ReminderForm from '../components/ReminderForm'
import { useToast } from '../components/Toast'
import type { FullSettings, ReminderTask } from '../types'

const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

export default function SettingsPage() {
  const [settings, setSettings] = useState<FullSettings>({
    ai: { provider: 'deepseek', base_url: 'https://api.deepseek.com', api_key: '', model: 'deepseek-chat' },
    smtp: { host: '', port: 587, username: '', password: '' },
    reminders: [],
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [showSMTPPass, setShowSMTPPass] = useState(false)
  const [reminderForm, setReminderForm] = useState<ReminderTask | null>(null)
  const [showReminderForm, setShowReminderForm] = useState(false)
  const [testing, setTesting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    api.getSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.saveSettings(settings)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // Reminder operations
  const handleCreateReminder = async (data: Partial<ReminderTask>) => {
    try {
      await api.createReminder(data)
      const updated = await api.listReminders()
      setSettings((s) => ({ ...s, reminders: updated }))
      setShowReminderForm(false)
      setReminderForm(null)
    } catch (err: any) {
      toast.error(err.message || '创建失败')
    }
  }

  const handleUpdateReminder = async (data: Partial<ReminderTask>) => {
    if (!reminderForm) return
    try {
      await api.updateReminder(reminderForm.id, data)
      const updated = await api.listReminders()
      setSettings((s) => ({ ...s, reminders: updated }))
      setShowReminderForm(false)
      setReminderForm(null)
    } catch (err: any) {
      toast.error(err.message || '更新失败')
    }
  }

  const handleDeleteReminder = async (id: string) => {
    const ok = await toast.confirm('确定要删除这个提醒吗？')
    if (!ok) return
    try {
      await api.deleteReminder(id)
      setSettings((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }))
    } catch {
      toast.error('删除失败')
    }
  }

  const handleTestEmail = async () => {
    if (!settings.smtp.host || !settings.smtp.username) {
      toast.error('请先填写 SMTP 服务器和发件邮箱')
      return
    }
    setTesting(true)
    try {
      await api.testEmail()
      toast.success('测试邮件发送成功，请检查收件箱')
    } catch (err: any) {
      toast.error(err.message || '发送失败')
    } finally {
      setTesting(false)
    }
  }

  const handleToggleReminder = async (task: ReminderTask) => {
    try {
      await api.updateReminder(task.id, { enabled: !task.enabled })
      setSettings((s) => ({
        ...s,
        reminders: s.reminders.map((r) => (r.id === task.id ? { ...r, enabled: !r.enabled } : r)),
      }))
    } catch {
      toast.error('操作失败')
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="skeleton h-9 w-36" />
          <div className="skeleton h-5 w-72" />
        </div>
        <div className="skeleton h-80 max-w-2xl rounded-xl" />
      </div>
    )
  }

  const inputClass = "w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none transition-all duration-200 focus:border-border-focus placeholder:text-text-tertiary/50"

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">系统设置</h1>
        <p className="mt-1.5 text-text-secondary text-sm">
          配置 AI 服务、邮件提醒和定时通知。
        </p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Section 1: AI Config */}
        <div className="rounded-xl border border-border bg-bg-elevated p-6 space-y-5 animate-fade-up stagger-1">
          <div className="flex items-center gap-3 pb-5 border-b border-border-subtle">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-subtle">
              <Server className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-text-primary">AI 服务配置</h2>
              <p className="text-xs text-text-tertiary mt-0.5">支持 OpenAI 兼容接口</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">服务商</label>
            <select
              value={settings.ai.provider}
              onChange={(e) => {
                const v = e.target.value
                const defaults: Record<string, { base_url: string; model: string }> = {
                  deepseek: { base_url: 'https://api.deepseek.com', model: 'deepseek-chat' },
                  openai: { base_url: 'https://api.openai.com', model: 'gpt-4o' },
                  ollama: { base_url: 'http://localhost:11434', model: 'llama3' },
                  custom: { base_url: '', model: '' },
                }
                setSettings({ ...settings, ai: { ...settings.ai, provider: v, ...defaults[v] } })
              }}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama (本地)</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">API 地址</label>
            <input
              type="text"
              value={settings.ai.base_url}
              onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, base_url: e.target.value } })}
              placeholder="https://api.deepseek.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">API Key</label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={settings.ai.api_key}
                onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, api_key: e.target.value } })}
                placeholder="sk-..."
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">模型</label>
            <input
              type="text"
              value={settings.ai.model}
              onChange={(e) => setSettings({ ...settings, ai: { ...settings.ai, model: e.target.value } })}
              placeholder="deepseek-chat"
              className={inputClass}
            />
          </div>
        </div>

        {/* Section 2: SMTP Config */}
        <div className="rounded-xl border border-border bg-bg-elevated p-6 space-y-5 animate-fade-up stagger-2">
          <div className="flex items-center gap-3 pb-5 border-b border-border-subtle">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-info-bg">
              <Mail className="h-4 w-4 text-info" />
            </div>
            <div>
              <h2 className="font-serif text-base font-semibold text-text-primary">邮件提醒配置</h2>
              <p className="text-xs text-text-tertiary mt-0.5">配置 SMTP 以发送定时提醒邮件</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">SMTP 服务器</label>
              <input
                type="text"
                value={settings.smtp.host}
                onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, host: e.target.value } })}
                placeholder="smtp.qq.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">端口</label>
              <input
                type="number"
                value={settings.smtp.port}
                onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, port: Number(e.target.value) } })}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">发件邮箱</label>
            <input
              type="email"
              value={settings.smtp.username}
              onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, username: e.target.value } })}
              placeholder="your@email.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">SMTP 密码 / 授权码</label>
            <div className="relative">
              <input
                type={showSMTPPass ? 'text' : 'password'}
                value={settings.smtp.password}
                onChange={(e) => setSettings({ ...settings, smtp: { ...settings.smtp, password: e.target.value } })}
                placeholder="授权码"
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowSMTPPass(!showSMTPPass)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-tertiary hover:text-text-secondary transition-colors"
              >
                {showSMTPPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-1">
            <button
              onClick={handleTestEmail}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              type="button"
            >
              {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {testing ? '发送中...' : '发送测试邮件'}
            </button>
          </div>
        </div>

        {/* Section 3: Reminders */}
        <div className="rounded-xl border border-border bg-bg-elevated p-6 space-y-5 animate-fade-up stagger-3">
          <div className="flex items-center justify-between pb-5 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-bg">
                <Bell className="h-4 w-4 text-warning" />
              </div>
              <div>
                <h2 className="font-serif text-base font-semibold text-text-primary">定时提醒</h2>
                <p className="text-xs text-text-tertiary mt-0.5">管理定时邮件提醒任务</p>
              </div>
            </div>
            <button
              onClick={() => { setReminderForm(null); setShowReminderForm(true) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
              type="button"
            >
              <Plus className="h-3.5 w-3.5" />
              添加提醒
            </button>
          </div>

          {settings.reminders.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-8">暂无提醒任务，点击上方按钮添加</p>
          ) : (
            <div className="space-y-2">
              {settings.reminders.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-4 rounded-lg border border-border-subtle bg-bg-surface/50 px-4 py-3"
                >
                  <button
                    onClick={() => handleToggleReminder(task)}
                    className="text-text-tertiary hover:text-accent transition-colors"
                    type="button"
                  >
                    {task.enabled ? (
                      <ToggleRight className="h-5 w-5 text-accent" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{task.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        task.schedule_type === 'daily' ? 'bg-info-bg text-info' : 'bg-purple-bg text-purple'
                      }`}>
                        {task.schedule_type === 'daily' ? '每日' : '每周'}
                      </span>
                      {task.schedule_type === 'weekly' && (
                        <span className="text-xs text-text-tertiary">{weekdays[task.weekday]}</span>
                      )}
                    </div>
                    <p className="text-xs text-text-tertiary mt-0.5 truncate">
                      {task.time} — {task.message}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setReminderForm(task); setShowReminderForm(true) }}
                      className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
                      type="button"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteReminder(task.id)}
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
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed animate-fade-up stagger-4"
          type="button"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saved ? '已保存' : '保存配置'}
        </button>
      </div>

      {/* Reminder Form Modal */}
      {showReminderForm && (
        <ReminderForm
          task={reminderForm}
          onSave={reminderForm ? handleUpdateReminder : handleCreateReminder}
          onClose={() => { setShowReminderForm(false); setReminderForm(null) }}
        />
      )}
    </div>
  )
}
