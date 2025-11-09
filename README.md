## AI 动态词汇练习应用

一个完全由 AI 实时驱动的词汇训练应用：上传单词表图片，Gemini 2.5 Flash 读取词汇，Polaris Alpha 生成 3 大题型（共 60 题）的“超级 JSON”，并在练习结束后用中文输出 100 字左右的分析报告。游客模式使用浏览器 LocalStorage 保存历史，登录用户的记录则写入本地 SQLite 数据库。

### 核心特性

- ⚙️ **React + TypeScript SPA**：包含登录/注册、游客入口、Dashboard、题流练习、报告与历史等完整流程。
- 🧠 **VLM 识别**：服务端通过 `google/gemini-2.5-flash-preview-09-2025` 读取图片中的词汇，前端展示为标签，可手动增删。
- 🧩 **超级 JSON 生成**：调用 `openrouter/polaris-alpha`，一次性生成 3×N 题、所有干扰项与提示，强制遵守 JSON Schema。
- 🚴 **题流体验**：严格单向流，无法回退，进度条实时反馈。
- 📊 **AI 中文分析**：提交后把答题记录与超级 JSON 发给 Polaris Alpha，输出中文报告与 2-4 条建议。
- 🔁 **错题强化**：报告页一键选取薄弱词重新触发超级请求。
- 💾 **游客/登录双模式**：游客记录保存在 LocalStorage；登录用户使用 JWT + SQLite 永久存储。

### 技术栈

- 前端：React 19（Vite）、React Router、Zustand、TypeScript、Axios
- 后端：Node.js + Express + TypeScript、SQLite（better-sqlite3 同步驱动）
- AI：OpenRouter `google/gemini-2.5-flash-preview-09-2025`（VLM）与 `openrouter/polaris-alpha`（题目与分析），使用 `response_format.json_schema` 获取结构化输出

---

## 快速开始

### 1. 准备环境

```bash
npm install
```

前端依赖安装在 `client/`，后端依赖安装在 `server/`。

### 2. 配置环境变量

复制仓库根目录的 `.env.example` 为 `.env`（**只能放在仓库根目录**，前端与后端都会直接读取）并填写：

```env
OPENROUTER_API_KEY=sk-or-xxxxxxxxxxxxxxxx
OPENROUTER_APP_TITLE=AI Vocab Trainer
OPENROUTER_REFERER=http://localhost:5173
OPENROUTER_PROXY=http://127.0.0.1:7890
VITE_MAX_VLM_IMAGES=5
PORT=4000
CLIENT_ORIGINS=http://localhost:5173,http://localhost:5174
JWT_SECRET=super-secret-value
DATABASE_PATH=./storage/vocab.db
VITE_API_BASE_URL=http://localhost:4000/api
```

> **安全提示**：请把提供的 `sk-or-v1-0870…` API Key 填入 `OPENROUTER_API_KEY`，不要硬编码在前端。

### 3. 启动开发环境

在项目根目录运行：

```bash
npm run dev
```

等效于同时执行：

- `npm run dev --workspace=server` → 监听 `http://localhost:4000`
- `npm run dev --workspace=client` → Vite 前端 `http://localhost:5173`

### 4. 生产构建

```bash
# Client build
npm run build --workspace=client

# Server build（记得提供必需的 env，例如）
OPENROUTER_API_KEY=dummy JWT_SECRET=dummy npm run build --workspace=server
```

---

## 前端结构摘要

```
client/src
├── App.tsx                 # 路由配置 + 保护路由
├── components/AppLayout.tsx
├── pages/
│   ├── LandingPage.tsx     # 登录/注册 + 游客入口
│   ├── DashboardPage.tsx   # 主界面
│   ├── UploadPage.tsx      # 词表上传
│   ├── ConfirmWordsPage.tsx
│   ├── QuizPage.tsx        # 题流
│   ├── ReportPage.tsx
│   └── HistoryPage.tsx
├── store/
│   ├── useAuthStore.ts     # 游客/认证状态 & JWT
│   └── usePracticeStore.ts # 词表、超级 JSON、答题记录
├── lib/
│   ├── api.ts              # Axios 实例 + API 方法
│   ├── storage.ts          # LocalStorage 工具
│   └── file.ts             # File → base64
└── types/index.ts          # Super JSON、Session、Analysis 类型
```

关键流程：

1. `UploadPage` 将图片转换为 base64 并请求 `/api/vlm/extract`。
2. `ConfirmWordsPage` 允许增删词条，并触发 `/api/generation/super-json`（选择难度后）。
3. `QuizPage` 根据超级 JSON 生成题流，提交后调用 `/api/analysis/report`。
4. 客户端计算得分并根据模式保存：
   - 游客：`saveGuestSession` → LocalStorage
   - 登录：`saveAuthenticatedSession` → `/api/history`

---

## 后端接口

| 方法 | 路径 | 说明 |
| ---- | ---- | ---- |
| `POST /api/auth/register` | 注册并返回 JWT |
| `POST /api/auth/login` | 登录 |
| `GET /api/auth/me` | 返回当前用户（若 token 可用） |
| `POST /api/vlm/extract` | 调用  google/gemini-2.5-flash-preview-09-2025 识别词表图片（body: `{ imageBase64 }`） |
| `POST /api/generation/super-json` | 使用 Polaris Alpha 生成 3×N 题的超级 JSON |
| `POST /api/analysis/report` | 发送答题记录，返回中文报告与建议 |
| `POST /api/history` | 保存登录用户的练习快照 |
| `GET /api/history` | 查询当前用户的所有历史 |
| `GET /api/history/:id` | 查询单次练习详情 |

### OpenRouter 约束

- **VLM 提词**：`model: google/gemini-2.5-flash-preview-09-2025`，`response_format` 限制输出 `{ words: string[] }`
- **超级 JSON**：`model: openrouter/polaris-alpha`，严格的 JSON Schema（3 个题组、4 选 1、中文解释）
- **分析报告**：同样使用 Polaris Alpha，schema 要求 `{ report: string, recommendations: string[] }`

所有请求均带上：

- `Authorization: Bearer <OPENROUTER_API_KEY>`
- `HTTP-Referer` / `X-Title`（用于排行榜归属，可在 `.env` 控制）

---

## 游客模式 & 历史数据

- 游客的练习记录保存在浏览器 `localStorage`（最多 12 条），可在主界面点击“查看历史记录”。
- 登录模式下所有记录写入 `server/storage/vocab.db`（SQLite），带有完整的超级 JSON、答案与 AI 报告，可从任意设备读取。

---

## 开发建议 & 下一步

1. **生产部署**：建议将 server 部署在支持 Node 18+ 的环境，使用 `pm2` 或 Docker，并把 SQLite 替换为云数据库（Postgres/MySQL）。
2. **安全**：若要在浏览器调用后端 API，请通过 `.env` 配置允许的 `CLIENT_ORIGINS`；生产环境不要在前端暴露 Operator Key。
3. **扩展**：可以增加实时流式生成（OpenRouter 支持 streaming）、更多题型或语音输入等增强功能。
