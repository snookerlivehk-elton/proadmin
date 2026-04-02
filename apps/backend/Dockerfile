FROM node:18-bullseye-slim AS base
WORKDIR /app
# 安裝 OpenSSL 與憑證（Prisma 引擎相依）
RUN apt-get update && \
    apt-get install -y --no-install-recommends openssl ca-certificates && \
    rm -rf /var/lib/apt/lists/*
# 先複製 package 定義與 prisma schema，確保安裝時 postinstall/prisma 能找到 schema
COPY package.json ./package.json
COPY prisma ./prisma
# 安裝依賴並生成 Prisma Client（使用 npm install，避免缺少 package-lock 導致 npm ci 失敗）
RUN npm install && npx prisma generate
# 複製其餘原始碼並建置
COPY tsconfig.json ./tsconfig.json
COPY src ./src
RUN npm run build

FROM node:18-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
EXPOSE 3000
# 使用 package.json 的 start，會在啟動時執行 `prisma db push` 後再啟動服務
CMD ["npm", "start"]
