import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, FileText, ArrowRight, Plus, Sparkles, CheckSquare, Bookmark } from 'lucide-react'
import { api } from '../lib/api'
import { getToday, getWeekStart, getWeekEnd } from '../lib/utils'
import { useAuth } from '../context/AuthContext'
import type { DailyReport, KnowledgeItem, Task, WeeklyReport } from '../types'

export default function Dashboard() {
  const { user } = useAuth()
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null)
  const [weekReport, setWeekReport] = useState<WeeklyReport | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [recentKnowledge, setRecentKnowledge] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [daily, weekReport, tasksData, knowledgeData] = await Promise.all([
          api.getDailyReport(getToday()).catch(() => null),
          api.getWeeklyReport(`${getWeekStart()}_${getWeekEnd()}`).catch(() => null),
          api.listTasks().catch(() => []),
          api.listKnowledge().catch(() => []),
        ])
        setTodayReport(daily)
        setWeekReport(weekReport)
        setTasks(tasksData || [])
        setRecentKnowledge((knowledgeData || []).slice(0, 3))
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-2">
          <div className="skeleton h-9 w-32" />
          <div className="skeleton h-5 w-64" />
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-44 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const todoCount = tasks.filter((t) => t.status === 'todo').length
  const doingCount = tasks.filter((t) => t.status === 'doing').length
  const today = getToday()
  const dueTodayCount = tasks.filter((t) => t.due_date === today && t.status !== 'done').length

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
          仪表盘
        </h1>
        <p className="mt-2 text-text-secondary text-sm">
          欢迎回来，{user?.email?.split('@')[0] ?? ''}。
        </p>
      </div>

      {/* Cards */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Daily card */}
        <Link
          to="/daily"
          className="group animate-fade-up stagger-1 rounded-xl border border-border bg-bg-elevated p-6 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_0_30px_var(--accent-glow)]"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-subtle">
              <CalendarDays className="h-5 w-5 text-accent" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-tertiary opacity-0 translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
          <h3 className="mt-5 font-serif text-lg font-semibold text-text-primary">今日日报</h3>
          <p className="mt-1.5 text-sm text-text-secondary">
            {todayReport ? '今日已填写，点击查看或编辑' : '今天还没写日报，点击开始'}
          </p>
          <div className="mt-4">
            {todayReport ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                已填写
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                <Plus className="h-3 w-3" />
                去填写
              </span>
            )}
          </div>
        </Link>

        {/* Weekly card */}
        <Link
          to="/weekly"
          className="group animate-fade-up stagger-2 rounded-xl border border-border bg-bg-elevated p-6 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_0_30px_var(--accent-glow)]"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-bg">
              <FileText className="h-5 w-5 text-purple" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-tertiary opacity-0 translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
          <h3 className="mt-5 font-serif text-lg font-semibold text-text-primary">本周周报</h3>
          <p className="mt-1.5 text-sm text-text-secondary">
            {weekReport
              ? weekReport.status === 'confirmed'
                ? '本周周报已确认'
                : '草稿已生成，点击确认'
              : '点击生成本周周报'}
          </p>
          <div className="mt-4">
            {weekReport ? (
              weekReport.status === 'confirmed' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2.5 py-1 text-xs font-medium text-success">
                  已确认
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-info">
                  待确认
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-bg px-2.5 py-1 text-xs font-medium text-purple">
                <Sparkles className="h-3 w-3" />
                AI 生成
              </span>
            )}
          </div>
        </Link>

        {/* Tasks card */}
        <Link
          to="/tasks"
          className="group animate-fade-up stagger-3 rounded-xl border border-border bg-bg-elevated p-6 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_0_30px_var(--accent-glow)]"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success-bg">
              <CheckSquare className="h-5 w-5 text-success" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-tertiary opacity-0 translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
          <h3 className="mt-5 font-serif text-lg font-semibold text-text-primary">任务概览</h3>
          <p className="mt-1.5 text-sm text-text-secondary">
            {tasks.length > 0
              ? `待处理 ${todoCount} 个，进行中 ${doingCount} 个`
              : '暂无任务，点击创建'}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {todoCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-bg px-2.5 py-1 text-xs font-medium text-warning">
                待处理 {todoCount}
              </span>
            )}
            {doingCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-info-bg px-2.5 py-1 text-xs font-medium text-info">
                进行中 {doingCount}
              </span>
            )}
            {dueTodayCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-600">
                今日到期 {dueTodayCount}
              </span>
            )}
            {tasks.length === 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-bg px-2.5 py-1 text-xs font-medium text-purple">
                <Plus className="h-3 w-3" />
                创建任务
              </span>
            )}
          </div>
        </Link>

        {/* Knowledge card */}
        <Link
          to="/knowledge"
          className="group animate-fade-up stagger-4 rounded-xl border border-border bg-bg-elevated p-6 transition-all duration-300 hover:border-accent/25 hover:shadow-[0_0_30px_var(--accent-glow)]"
        >
          <div className="flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-info-bg">
              <Bookmark className="h-5 w-5 text-info" />
            </div>
            <ArrowRight className="h-4 w-4 text-text-tertiary opacity-0 translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
          </div>
          <h3 className="mt-5 font-serif text-lg font-semibold text-text-primary">最近收藏</h3>
          <p className="mt-1.5 text-sm text-text-secondary">
            {recentKnowledge.length > 0
              ? `共 ${recentKnowledge.length} 条知识片段`
              : '暂无收藏，点击添加'}
          </p>
          <div className="mt-4">
            {recentKnowledge.length > 0 ? (
              <div className="space-y-1">
                {recentKnowledge.map((item) => (
                  <div key={item.id} className="flex items-center gap-1.5 text-xs text-text-secondary truncate">
                    <span className="text-text-tertiary shrink-0">
                      {item.type === 'link' ? '🔗' : item.type === 'snippet' ? '💻' : '📝'}
                    </span>
                    <span className="truncate">{item.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-purple-bg px-2.5 py-1 text-xs font-medium text-purple">
                <Plus className="h-3 w-3" />
                添加知识
              </span>
            )}
          </div>
        </Link>
      </div>
    </div>
  )
}
