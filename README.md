# 階層式專案協作平台 (Hierarchical Project Collaboration Platform)

本專案是一個支援無限層級嵌套、權限委託、以及極簡化加入流程的協作系統。

## 核心概念

- **無限層級子專案**：支援 Materialized Path 樹狀結構。
- **權限委託**：Manager 可在管轄範圍內建立子專案並邀請成員。
- **極簡加入**：支援 Google OAuth 與 Email 免 Token 加入（受邀者匹配 Email）。
- **業務整合**：未來將支援項目金額匯總、財務結算、報價單與發票生成。

***

## 🚀 開發進度記錄 (Development Progress)

### 1. 系統架構 (System Architecture)

- [x] **前端呈現層 (Web SPA)**：React + Tailwind CSS + Vite (已部署至 Railway)
- [x] **API 服務層 (Backend)**：Node.js + Express + TypeScript (已部署至 Railway)
- [x] **資料存取層 (Prisma)**：PostgreSQL + Prisma ORM (已自動同步 Schema)
- [x] **安全與權限層**：JWT Cookie-based Auth + Role-based Middleware

### 2. 核心模組 (Domain Modules)

- [x] **使用者領域 (User)**：Google Login、Email 註冊登入
- [x] **專案階層領域 (Project Hierarchy)**：樹狀路徑、子專案建立、父專案導航
- [x] **成員與邀請領域 (Membership & Invitation)**：發送邀請、撤回、接受、拒絕、刪除紀錄、免 Token 加入
- [x] **權限與角色領域 (Authorization)**：Owner / Manager / Viewer 角色與權限繼承
- [ ] **活動記錄領域 (Audit Log)**：後端模型已建立，API 與 UI 待實作
- [ ] **通知領域 (Notification)**：目前為儀表板輪詢通知，郵件通知待整合

### 3. 使用者操作流程 (Workflow)

- [x] 建立頂層專案 (Auto-Manager)
- [x] 邀請成員 (Email 邀請)
- [x] 成員加入 (Google / Email Login + 自動受邀列表)
- [x] 子專案建立與管理 (權限繼承)

***

## 🛠️ 技術細節 (Technical Details)

- **Monorepo**: 使用 `apps/backend` 與 `apps/web`
- **Database**: PostgreSQL (Railway Managed)
- **Auth**: JWT (HttpOnly, SameSite=None, Secure)
- **Deployment**: Docker Multi-stage Build + Railway CI/CD

***

## 📅 後續開發清單 (Roadmap)

### 第一階段：基礎優化 (進行中)

- [ ] **活動記錄 (Audit Log)**：展示專案操作時間軸。
- [ ] **檔案上傳 (Storage)**：支援圖片與文件上傳 (S3/R2 預定)。
- [ ] **成員移除機制**：Manager 可移除現有成員。

### 第二階段：財務與報告 (擴展功能)

- [ ] **項目金額管理**：每個項目/子項目可設定金額。
- [ ] **財務匯總**：自動計算子項目總額。
- [ ] **報價單/發票生成**：根據項目數據生成 PDF。
- [ ] **工作報告系統**：Viewer 可回報進度與上傳檔案。

### 第三階段：體驗優化

- [ ] **多語言支援**：中英文切換。
- [ ] **郵件通知**：整合 Resend/SendGrid 真正寄出邀請信。
- [ ] **效能優化**：大型專案樹的懶加載 (Lazy Loading)。

***

## 快速啟動 (Local Development)

1. `docker compose up -d` (Postgres)
2. `cd apps/backend && npm install && npx prisma db push`
3. `cd apps/web && npm install`
4. 分別啟動 `npm run dev`

