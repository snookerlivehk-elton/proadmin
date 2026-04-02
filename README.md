# Hierarchical Project Collaboration Platform (hp-collab)

本專案為「階層式專案協作平台」的最小可用骨架，採 Monorepo 結構，先以 Backend 落地核心能力（/healthz、Prisma schema），後續再接前端與 Railway。

## 結構
- apps/backend：Node.js + TypeScript + Express + Prisma
- docker-compose.yml：本地 Postgres/Redis

## 本地開發
1. 啟動資料服務
   - `docker compose up -d`
2. 設定環境變數
   - 複製 `apps/backend/.env.example` 為 `apps/backend/.env` 並填入 DATABASE_URL 等
3. 生成 Prisma Client 與遷移
   - 進入 `apps/backend`
   - `npm install`
   - `npx prisma generate`
   - `npx prisma migrate dev --name init`
4. 啟動後端
   - `npm run dev`
   - 瀏覽 `http://localhost:3000/healthz` 檢查服務

## 推送 GitHub 與 Railway
- 推送本倉庫至 GitHub，於 Railway 建立 Project 並連接此 Repo
- 建立 Postgres、Redis；在 Railway 設定環境變數（與 `.env.example` 對應）
- 部署後以 `/healthz` 驗證

## 重要環境變數
- `DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`
- `PROJECT_CREATION_POLICY`、`ADMIN_EMAILS`、`ALLOWED_DOMAINS`
- `APP_BASE_URL`、`PORT`

## 授權政策
- 可設定頂層專案建立策略（ALL_USERS、DOMAIN_WHITELIST、INVITE_ONLY、SUPERADMIN_ONLY）

## 後續
- 接入 Google OAuth、邀請流程、權限繼承與樹狀查詢
- 加入前端 SPA 與多語
