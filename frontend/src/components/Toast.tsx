import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react'

type ToastType = 'success' | 'error'

interface Toast {
  id: number
  type: ToastType
  message: string
  leaving: boolean
}

interface ConfirmState {
  message: string
  resolve: (v: boolean) => void
}

interface ToastContextValue {
  success: (message: string) => void
  error: (message: string) => void
  confirm: (message: string) => Promise<boolean>
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastId = 0

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, type, message, leaving: false }])
    setTimeout(() => {
      // Start leave animation
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      // Remove after animation
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300)
    }, 3200)
  }, [])

  const success = useCallback((message: string) => addToast('success', message), [addToast])
  const error = useCallback((message: string) => addToast('error', message), [addToast])

  const confirm = useCallback(
    (message: string): Promise<boolean> =>
      new Promise((resolve) => {
        setConfirmState({ message, resolve })
      }),
    [],
  )

  const dismissConfirm = (result: boolean) => {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  return (
    <ToastContext.Provider value={{ success, error, confirm }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm transition-all duration-300 min-w-[280px] max-w-[420px] ${
              t.leaving
                ? 'opacity-0 translate-x-8 scale-95'
                : 'opacity-100 translate-x-0 scale-100 animate-fade-up'
            } ${
              t.type === 'success'
                ? 'border-success/30 bg-success-bg/95 text-success'
                : 'border-red-200 bg-red-50/95 text-red-700'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
            ) : (
              <XCircle className="h-4.5 w-4.5 shrink-0" />
            )}
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => {
                setToasts((prev) => prev.map((x) => (x.id === t.id ? { ...x, leaving: true } : x)))
                setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 300)
              }}
              className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-sm animate-fade-in"
          onClick={() => dismissConfirm(false)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-bg-elevated p-6 shadow-xl animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-bg">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-serif text-base font-semibold text-text-primary">确认操作</h3>
                <p className="mt-1.5 text-sm text-text-secondary leading-relaxed">{confirmState.message}</p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => dismissConfirm(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
              >
                取消
              </button>
              <button
                onClick={() => dismissConfirm(true)}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 transition-all"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
