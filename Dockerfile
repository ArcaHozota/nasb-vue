# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable yarn
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable
COPY . .
RUN yarn build

# --- runtime stage: 静的配信(SPA) ---
# /api は前段(nginx/CloudFront等)でバックエンドへルーティングする想定。
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
