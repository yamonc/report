import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, LogIn } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Already logged in
  if (user) {
    navigate('/', { replace: true })
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('请输入邮箱')
      return
    }
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(email.trim())) {
      setError('邮箱格式不正确')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-root p-4">
      <div className="w-full max-w-sm animate-fade-up">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15 text-accent font-bold text-xl font-serif">
            日
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-text-primary">
            工作日报
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            登录以继续使用
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-bg-elevated p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              autoFocus
              autoComplete="email"
              className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none transition-all duration-200 focus:border-border-focus placeholder:text-text-tertiary/50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="任意密码"
              autoComplete="current-password"
              className="w-full rounded-lg border border-border bg-bg-surface px-3.5 py-2.5 text-sm text-text-primary outline-none transition-all duration-200 focus:border-border-focus placeholder:text-text-tertiary/50"
            />
            <p className="mt-1 text-xs text-text-tertiary">首次登录将自动注册</p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-[#1a1a16] transition-all hover:bg-accent-soft disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_var(--accent-glow)]"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="h-4 w-4" />
            )}
            {loading ? '登录中...' : '登录 / 注册'}
          </button>
        </form>
      </div>
    </div>
  )
}
