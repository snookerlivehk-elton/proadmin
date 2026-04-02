# 階段 1: Build
FROM node:20-slim AS build
WORKDIR /app

# 複製根 package.json
COPY package.json .
# 建立 apps 目錄結構
RUN mkdir -p apps/web

# 複製 web 專案
COPY apps/web/package.json ./apps/web/
# 安裝依賴 (使用 --include=dev 確保包含 vite)
RUN npm install

# 複製其餘代碼
COPY apps/web ./apps/web

# 建構前端
WORKDIR /app/apps/web
# 如果有後端 URL 的環境變數，可以在這裡傳入 (或是運行時由 Nginx 配置)
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
