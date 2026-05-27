# 工作周报系统 — 部署指南

## 架构概览

```
用户浏览器                    ECS 云服务器 (Docker)
─────────                    ─────────────────────
  localhost:8080  ──SSH隧道──▶  127.0.0.1:80 (nginx)
                                    │
                               /api/* 反向代理
                                    │
                                    ▼
                               127.0.0.1:8080 (Go backend)
                                    │
                               ┌────┼────┐
                               ▼    ▼    ▼
                              /data (JSON 文件存储)
                              ├── daily_reports.json
                              ├── weekly_reports.json
                              ├── users.json
                              ├── reminders.json
                              └── settings.json
                                    
JWT 认证：POST /api/v1/auth/login（首次即注册）
定时调度：每分钟检查提醒任务 → SMTP 发送邮件
```

所有服务只监听 `127.0.0.1`，不暴露任何公网端口。用户通过 SSH 隧道安全访问。

---

## 1. 前置要求

| 依赖 | 版本建议 | 说明 |
|------|---------|------|
| Docker | ≥ 20.10 | 构建与运行容器 |
| Docker Compose | ≥ 1.29 | 编排服务 |
| SSH 客户端 | 任意 | 建立隧道连接 |

> **国内服务器**：Docker Hub 默认被墙，需先配置镜像加速，见第 2 节。

---

## 2. Docker 镜像加速（国内服务器必做）

编辑 `/etc/docker/daemon.json`：

```json
{
  "registry-mirrors": [
    "https://docker.1ms.run",
    "https://docker.xuanyuan.me"
  ]
}
```

然后重启 Docker：

```bash
sudo systemctl daemon-reload
sudo systemctl restart docker
```

---

## 3. 项目文件清单

部署所需的全部文件（放到服务器上任意目录，如 `~/report/`）：

```
~/report/
├── backend/           # Go 后端源码
├── frontend/          # React 前端源码
├── Dockerfile         # 多阶段构建
├── docker-compose.yml # 服务编排
├── nginx.conf         # Nginx 配置（只监听 127.0.0.1:80）
├── entrypoint.sh      # 容器启动脚本
└── .dockerignore      # 构建排除
```

---

## 4. 关键配置说明

### 4.1 Go 后端 — 只绑 loopback

`backend/main.go` 中 `ListenAndServe` 地址必须为 `127.0.0.1:PORT`，**不能**是 `:PORT`（后者监听所有网卡）：

```go
addr := "127.0.0.1:" + cfg.Port
http.ListenAndServe(addr, handler)
```

### 4.2 Nginx — 只绑 loopback

`nginx.conf` 中 listen 地址必须是 `127.0.0.1`：

```nginx
server {
    listen 127.0.0.1:80;   # 仅本地，公网不可达

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_read_timeout 120s;
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;  # SPA fallback
    }
}
```

### 4.3 Docker Compose — host 网络 + 数据持久化

```yaml
services:
  work-report:
    build: .
    restart: unless-stopped
    network_mode: host          # 复用宿主机网络栈（127.0.0.1 即宿主机的 127.0.0.1）
    volumes:
      - ./data:/data            # 宿主机 ./data 目录持久化 JSON 数据
    environment:
      - PORT=8080
      - DB_PATH=/data
      - DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY:-}
```

> **数据文件位置**：所有日报、周报、设置的 JSON 文件存储在宿主机的 `./data` 目录下，容器删除后数据不丢失。

### 4.4 前端 API 请求路径

生产环境 nginx 做反向代理，前端请求路径为相对路径 `/api/v1`：

```typescript
// frontend/src/lib/api.ts
const BASE = '/api/v1'
```

---

## 5. 部署步骤

### 5.1 上传代码到服务器

```bash
# 方式一：rsync（推荐）
rsync -avz --exclude 'node_modules' --exclude '.git' ./report/ user@your-server:~/report/

# 方式二：scp
scp -r ./report user@your-server:~/
```

### 5.2 构建并启动

```bash
cd ~/report

# 构建镜像并后台启动
docker compose up -d --build
```

首次构建约需 3-5 分钟（Go 编译 + npm install + Vite 打包）。

### 5.3 验证服务

```bash
# 查看容器状态
docker compose ps

# 查看日志（Go 后端应打印 "Server starting on http://127.0.0.1:8080"）
docker compose logs -f

# 健康检查
curl http://127.0.0.1/api/v1/health
```

---

## 6. 用户访问方式

在本地电脑执行 SSH 隧道：

```bash
ssh -L 8080:localhost:80 -N user@your-server-ip
```

然后浏览器打开 `http://localhost:8080` 即可使用。

> 隧道断开后访问即中断，不会在公网留下任何入口。

---

## 7. 常见问题

### 7.1 端口 80 被占用

**现象**：容器日志报 `bind() to 127.0.0.1:80 failed (98: Address in use)`

**排查**：
```bash
ss -tlnp | grep :80
```

**解决**：
- 方案 A：停掉占用 80 的服务，然后 `docker compose restart`
- 方案 B：改用其他端口，修改 `nginx.conf` 中 `listen 127.0.0.1:8088;`，重建容器。隧道命令相应改为 `ssh -L 8080:localhost:8088 -N user@server`

### 7.2 Docker Hub 拉取超时

**现象**：`docker.io/library/golang:1.21-alpine: i/o timeout`

**原因**：国内网络封锁 Docker Hub

**解决**：按第 2 节配置镜像加速，重试即可。

### 7.3 tsc 权限错误

**现象**：Docker 构建时报 `tsc: Permission denied`

**原因**：Alpine 镜像中 `npm ci` 安装的 `node_modules/.bin/tsc` 缺少执行权限

**解决**（已在 Dockerfile 中处理）：不通过 `.bin/` 调用，直接用 `node` 运行：

```dockerfile
RUN node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build
```

### 7.4 TypeScript 编译错误

**现象**：`TS6133: 'Xxx' is declared but its value is never read`

**原因**：TS 严格模式，未使用的 import 视为错误

**解决**：移除未使用的 import。

---

## 8. 日常运维

```bash
# 更新代码后重建
cd ~/report && git pull && docker compose up -d --build

# 查看日志
docker compose logs -f --tail=50

# 重启服务
docker compose restart

# 停止服务
docker compose down

# 备份数据（就是备份 ./data 目录）
tar -czf backup-$(date +%Y%m%d).tar.gz ./data
```

---

## 9. 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API 密钥，AI 生成功能依赖 |
| `JWT_SECRET` | 否 | JWT 签名密钥，默认 `report-jwt-secret`。生产环境建议修改 |
| `PORT` | 否 | Go 后端端口，默认 8080 |
| `DB_PATH` | 否 | 数据存储路径，默认 `/data` |

建议在 `~/report/` 下创建 `.env` 文件：

```
DEEPSEEK_API_KEY=sk-your-key-here
JWT_SECRET=your-random-secret-here
```

> `.dockerignore` 已排除 `.env`，不会打包进镜像。

## 10. 用户系统

- 首次使用需登录：任意邮箱 + 任意非空密码即可（首次登录自动注册）
- JWT Token 24 小时过期
- 登录后在系统设置中配置 SMTP 以启用定时邮件提醒
- 定时提醒任务在设置页面中管理，支持自定义每日/每周提醒
