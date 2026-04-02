# 階段 1: Build
FROM node:20-slim AS build
WORKDIR /app

# 在 Monorepo 中，我們直接進入 web 目錄安裝
COPY apps/web/package.json ./apps/web/
WORKDIR /app/apps/web

# 安裝依賴
RUN npm install

# 複製 web 專案其餘代碼
COPY apps/web ./

# 建構前端
RUN npm run build

# 階段 2: Serve (使用 Nginx 輕量化)
FROM nginx:stable-alpine
# 複製建構好的檔案到 Nginx 目錄
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

# 建立自定義 Nginx 配置以支援 SPA 路由 (try_files)
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
