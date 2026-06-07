# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
# Backend (Go)
cd backend && go build -o server .   # Build
cd backend && go run .               # Run (serves on :8080)

# Frontend (React + Vite)
cd frontend && npm run dev           # Dev server (:5173, proxies /api → :8080)
cd frontend && npm run build         # Type-check + production build
cd frontend && npx tsc --noEmit      # Type-check only
```

## Architecture

```
Nginx :80 → /api/* → Go backend :8080
           → /*     → React SPA (Vite build output)

Go backend (net/http + custom ServeMux)
  ├── middleware/  (CORS → JWT Auth → handler)
  ├── handlers/    (ServeHTTP pattern — each handler is an http.Handler)
  ├── store/       (JSON file read/write in /data, sync.RWMutex guarded)
  ├── services/    (AI via OpenAI-compatible API, email via SMTP)
  └── scheduler/   (60s ticker for reminder email delivery)
```

## Backend patterns

**Handler as http.Handler**: Each module (daily_report, tasks, knowledge, etc.) exports a struct with a `ServeHTTP` method. The constructor takes `*store.Store`. Routes are registered in `main.go` with two patterns per prefix — one with trailing slash and one without.

**Store**: `store.Store` wraps a directory path. Each entity gets a `<name>.json` file. CRUD methods read-modify-write the full file under a mutex. The `readJSON` helper returns nil (empty slice) if the file doesn't exist — first write creates it.

**JWT**: `handlers/helpers.go` has `GenerateJWT` and `ParseJWT`. The auth middleware in `middleware/auth.go` injects `email` into the request context. Public paths are listed in the `publicPaths` map.

**ID generation**: `handlers/reminders.go` defines `generateID()` (timestamp-based) and `extractID()` — shared by all handlers in the package.

## Frontend patterns

**Layout**: `Layout.tsx` renders a fixed 200px sidebar with nav items + `<Outlet />` for page content (margin-left 240px). The app shell wraps everything in `AuthProvider` → `BrowserRouter`.

**API client**: `lib/api.ts` — thin wrapper around `fetch` that prepends `/api/v1`, injects the JWT Bearer token, and throws on non-OK responses.

**Types mirror backend models**: `types/index.ts` defines interfaces matching the Go structs exactly (snake_case JSON keys).

**Design tokens**: CSS custom properties in `index.css` define colors (`--accent`, `--bg-root`, `--text-primary`), radii, and font stacks (serif/sans/mono). Tailwind uses these via `@theme` or arbitrary values like `bg-bg-root`, `text-text-secondary`.

**Animations**: `animate-fade-up` with `.stagger-1` through `.stagger-6` delay classes. `skeleton` class for loading placeholders.

## Data flow

1. User logs in → JWT stored in localStorage → all API calls attach `Bearer <token>`
2. Dashboard loads 4 datasets in parallel (daily report, weekly report, tasks, knowledge)
3. Task kanban updates status via `PATCH /api/v1/tasks/:id/status`
4. Knowledge items support search + type filter + tag filter via query params
5. AI weekly report generation calls the configured LLM provider (default: DeepSeek) — saved as draft until user confirms
