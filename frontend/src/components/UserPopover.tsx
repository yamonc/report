import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings, User, LogOut, X } from 'lucide-react'
import type { User as UserType } from '../types'

interface Props {
  user: UserType
  onLogout: () => void
}

export default function UserPopover({ user, onLogout }: Props) {
  const [open, setOpen] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 text-text-secondary hover:bg-bg-hover hover:text-text-primary border border-transparent"
        type="button"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent text-xs font-bold font-serif">
          {user.email.charAt(0).toUpperCase()}
        </div>
        <span className="truncate flex-1 text-left">{user.email}</span>
      </button>

      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-border bg-bg-elevated shadow-lg p-1.5 animate-fade-up">
          <button
            onClick={() => { setShowInfo(true); setOpen(false) }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-200"
            type="button"
          >
            <User className="h-4 w-4" />
            用户信息
          </button>
          <button
            onClick={() => { navigate('/settings'); setOpen(false) }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-all duration-200"
            type="button"
          >
            <Settings className="h-4 w-4" />
            系统设置
          </button>
          <div className="my-1 border-t border-border-subtle" />
          <button
            onClick={() => { onLogout(); setOpen(false) }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-all duration-200"
            type="button"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      )}

      {/* User info modal */}
      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20" onClick={() => setShowInfo(false)}>
          <div
            className="mx-4 w-full max-w-sm rounded-xl border border-border bg-bg-elevated shadow-xl animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
              <h3 className="font-serif text-base font-semibold text-text-primary">用户信息</h3>
              <button
                onClick={() => setShowInfo(false)}
                className="rounded-lg p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <span className="text-xs text-text-tertiary">邮箱</span>
                <p className="text-sm text-text-primary mt-0.5">{user.email}</p>
              </div>
              <div>
                <span className="text-xs text-text-tertiary">注册时间</span>
                <p className="text-sm text-text-primary mt-0.5">
                  {new Date(user.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
