# --- Bun(パッケージ管理・スクリプトの起動)。package.json の packageManager と同じ版 ---
FROM oven/bun:1.4.5-alpine AS bun

# --- build stage ---
# ビルド(vue-tsc・Vite)は Node で動かし、Bun はインストールとスクリプトの起動だけに使う
FROM node:22-alpine AS build
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# --- runtime stage: 静的配信(SPA) ---
# /api は前段(nginx/CloudFront等)でバックエンドへルーティングする想定。
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
