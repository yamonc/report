# Stage 1: Build Go backend
FROM golang:1.21-alpine AS go-builder
ENV GOPROXY=https://goproxy.cn,direct
WORKDIR /app
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o report-server .

# Stage 2: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com && npm ci
COPY frontend/ ./
RUN node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build

# Stage 3: Runtime
FROM nginx:alpine
RUN apk add --no-cache ca-certificates tzdata

COPY --from=go-builder /app/report-server /usr/local/bin/report-server
COPY --from=frontend-builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

STOPSIGNAL SIGTERM
ENTRYPOINT ["/entrypoint.sh"]
