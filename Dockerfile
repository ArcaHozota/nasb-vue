# --- build stage ---
# Vue3+Viteの静的ビルドを行うだけの段階。最終イメージには含まれない。
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- runtime stage ---
# 旧 myapp-frontend(Next.js standalone, Node実行)を置き換え。
# 実行時にNode.jsは不要で、nginxが静的ファイルを配信するだけ。
FROM nginx:alpine AS runtime

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

# docker-compose.yml / edge nginx.conf 側を変更せずに済むよう、
# 旧Next.jsコンテナと同じポート3000のまま維持する。
EXPOSE 3000
