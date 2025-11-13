# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` — Starts both server (http://localhost:4000) and client (http://localhost:5173) concurrently using workspace scripts
- `npm run dev:server` — Run only the backend with hot reload (uses `tsx watch`)
- `npm run dev:client` — Run only the frontend Vite dev server
- `npm run build` — Build both workspaces; server runs TypeScript compilation, client runs Vite build
- `npm run lint --workspace=client` — Run ESLint on React/TypeScript code
- `npm run typecheck --workspace=server` — Type-check server code without emitting JS

### Server-specific
```bash
# In server/ directory
npm run dev          # tsx watch (auto-restarts on changes)
npm run build        # tsc -p tsconfig.json (outputs to dist/)
npm run start        # node dist/index.js (production)
npm run typecheck    # tsc --noEmit (validate types only)
```

### Client-specific
```bash
# In client/ directory
npm run dev          # vite (dev server)
npm run build        # tsc -b && vite build
npm run lint         # eslint .
npm run preview      # vite preview (preview production build)
```

## Environment Configuration

**Required:** Copy the repository root `.env.example` to `.env` (root only) and configure:
- `OPENROUTER_API_KEY` — Your OpenRouter API key (keep secret, never commit)
- `OPENROUTER_PROXY` — Optional proxy (e.g., http://127.0.0.1:7890) for all OpenRouter traffic
- `JWT_SECRET` — Strong secret for JWT token signing
- `CLIENT_ORIGINS` — Comma-separated frontend URLs (http://localhost:5173 for dev, include extra Vite ports if needed)
- `PORT` — Server port (default: 4000)
- `DATABASE_PATH` — SQLite database path (default: ./storage/vocab.db)
- `VITE_API_BASE_URL` — Client-side API origin (http://localhost:4000/api for dev)
- `VITE_MAX_VLM_IMAGES` — Shared upload limit exposed to both client and server

## High-Level Architecture

This is a full-stack AI-powered vocabulary training application with three core data flows:

### 1. Frontend (client/)
**Tech Stack:** React 19 + TypeScript + Vite + React Router + Zustand + Axios

**Structure:**
- `src/pages/` — Route components: LandingPage, DashboardPage, UploadPage, ConfirmWordsPage, QuizPage, ReportPage, HistoryPage
- `src/store/` — Zustand state management: useAuthStore (auth mode & JWT), usePracticeStore (words, super JSON, answers)
- `src/lib/` — API client (Axios), LocalStorage utilities, file-to-base64 conversion
- `src/types/` — TypeScript definitions for SuperJson, SessionSnapshot, AnswerRecord, AnalysisSummary

**Route Guards (client/src/App.tsx:16-49):**
- `ProtectedRoute` — Requires authentication or guest mode
- `RequireWords` — Redirects to upload if no word list exists
- `RequireSuperJson` — Redirects to confirmation if questions not generated
- `RequireResult` — Redirects to dashboard if no quiz results

**State Flow:**
1. Upload image(s) → `UploadPage` → convert to base64 → POST `/api/vlm/extract` 获取词表。
2. `ConfirmWordsPage` 确认/编辑单词并选择难度 → 并行触发 `POST /api/generation/session`（分段题库）与 `POST /api/generation/details`（词汇详情），将 snapshot + 词典写入 `usePracticeStore`。
3. 进入 `VocabularyDetailsPage` 查看词性/释义/双语例句，同时继续轮询 session 状态；详情生成失败可在此页重试，未完成该步骤无法开始答题。
4. 点击“开始练习”后进入 `QuizPage`，消费 `superJson` 里的题目并持续轮询后续题型，答案记录写入 `usePracticeStore.answers[]`。
5. 作答完成 → POST `/api/analysis/report` 生成中文总结，guest 模式存 LocalStorage，登录用户 POST `/api/history` 持久化 Session。

### 2. Backend (server/)
**Tech Stack:** Node.js + Express + TypeScript + SQLite (better-sqlite3) + JWT + bcryptjs

**Structure:**
- `src/index.ts` — Express app setup, CORS, routes, error handling
- `src/routes/` — API endpoints: auth.ts, vlm.ts, generation.ts, analysis.ts, history.ts
- `src/services/` — AI integration: openrouter.ts (OpenRouter API client), superGenerator.ts (Polaris Alpha), vlm.ts (Google Gemini 2.5), analysis.ts (report generation)
- `src/db/client.ts` — SQLite connection & migrations
- `src/middleware/auth.ts` — JWT authentication middleware
- `src/utils/httpError.ts` — Custom error class

**API Endpoints:**
- `POST /api/auth/register` / `/api/auth/login` / `GET /api/auth/me` — JWT auth lifecycle
- `POST /api/vlm/extract` — Gemini 2.5 Flash 提取词表
- `POST /api/generation/session` — 启动分段题库生成（立即返回第一大题 + sessionId）
- `GET /api/generation/session/:id` — 轮询 session 状态（题型 ready/pending/error）
- `POST /api/generation/session/:id/retry` — 针对指定题型重新生成
- `POST /api/generation/details` — 生成词性/中文释义/双语例句的词典详情
- `POST /api/generation/super-json` — 旧版一次性题库输出，仅作 fallback
- `POST /api/analysis/report` — 生成中文分析报告
- `POST /api/history` / `GET /api/history` / `GET /api/history/:id` — 会话存档与查询

**Key Services:**

**openrouter.ts (server/src/services/openrouter.ts:36-67):**
- HTTP client for OpenRouter API with proper headers
- Parses JSON responses from structured output
- Throws HttpError on API failures or invalid JSON

**superGenerator.ts (server/src/services/superGenerator.ts:4-106):**
- Enforces strict JSON schema for 3 question types
- Generates shuffled questions with natural distractors
- Temperature varies by difficulty (0.65 beginner/intermediate, 0.85 advanced)
- Outputs `SuperJson` with metadata, questions_type_1/2/3 arrays

**Database Schema (server/src/db/client.ts):**
- Auto-migrates on server start
- Users table: id, email, password_hash, created_at
- Sessions table: id, user_id, difficulty, words_json, super_json_json, answers_json, score, analysis_json, created_at

### 3. AI Integration (OpenRouter)

**Models:**
- `google/gemini-2.5-flash-preview-09-2025` — VLM for word extraction from images (server/src/services/vlm.ts)
- `openrouter/polaris-alpha` — Question generation and analysis (server/src/services/superGenerator.ts, analysis.ts)
- Both use `response_format.json_schema` for structured output

**Security:**
- API key 存放在仓库根目录 `.env` 中（前端不会暴露密钥）
- JWT tokens for authentication
- CORS restricted to CLIENT_ORIGINS
- Passwords hashed with bcryptjs

## Important Implementation Details

### Super JSON Structure (client/src/types/index.ts:23-33)
```typescript
{
  metadata: { totalQuestions, words[], difficulty, generatedAt },
  questions_type_1: SuperQuestion[],  // English meaning from Chinese
  questions_type_2: SuperQuestion[],  // Chinese meaning from English
  questions_type_3: SuperQuestion[]   // Sentence fill-in-the-blank
}
```

### Guest vs Authenticated Mode
- **Guest mode:** Data in `localStorage` (STORAGE_KEYS), max 12 sessions
- **Authenticated mode:** JWT + SQLite storage, unlimited history across devices
- Auth state managed in `useAuthStore.ts` with `hydrate()` on app load

### State Management (Zustand)
- **useAuthStore:** mode ('guest'|'authenticated'|'unauthenticated'), user, token, JWT persistence
- **usePracticeStore:** words[], superJson, answers[], status flow, lastResult with score/analysis

### Error Handling
- Global error handler in `server/src/index.ts:36-47`
- Custom `HttpError` class for API errors
- Frontend displays error messages in UI components

## Development Workflow

1. **Start dev environment:** `npm run dev` (runs both workspaces)
2. **Make changes:** Frontend hot-reloads, server auto-restarts with `tsx watch`
3. **Test flow:** Upload image → confirm words → generate quiz → take quiz → view report
4. **Check types:** `npm run typecheck --workspace=server`
5. **Lint code:** `npm run lint --workspace=client`
6. **Build for production:** `npm run build`

## Testing Notes
No automated test suite exists yet. Manual testing via `npm run dev` is required for all features. The quiz flow should be tested end-to-end: image upload → word confirmation → question generation → quiz taking → report viewing → history check.

## Common Development Patterns

- **API calls:** Use `lib/api.ts` Axios instance with JWT interceptors
- **Type validation:** Server uses `zod` for external data validation
- **Error responses:** `{ message: string }` JSON with appropriate HTTP status
- **State updates:** Use Zustand setters, never mutate state directly
- **File handling:** Images converted to base64 before API calls
- **Schema enforcement:** OpenRouter `json_schema` response_format ensures valid output

## Build & Deployment
- **Client:** Vite build outputs to `client/dist/` (static files)
- **Server:** TypeScript compilation outputs to `server/dist/` (Node.js app)
- **Database:** SQLite file at `server/storage/vocab.db` (included in deployments)
- **Production:** Use `npm run build` then `npm run start` for server, serve client dist/ with static host

## Recent Updates & Expectations
- **2025-02-14 句子遮挡策略**  
  - `server/src/services/superGenerator.ts` 先用 `[BLANK]...[/BLANK]` 包裹待考短语再整体替换为 `_____`，并在 translation/hint 禁止泄露答案；该流程写入通用 prompt 与 `QUESTION_TYPE_RULES`。  
  - `client/src/pages/QuizPage.tsx` 若 sentence 尚未包含 `_____`，会按答案首词（含 be/have/do 及常见时态/变形）生成多组匹配模式进行遮挡；老题或失控题仍兜底。上线前务必跑一次 `/api/generation/session` + Quiz 流程确认不会露题。  
- **2025-11-11 VLM 统一 Gemini 2.5 Flash**
  - `/api/vlm/extract` 使用 `google/gemini-2.5-flash-preview-09-2025` + ProxyAgent，并将 README、AGENTS、PROJECT_BOARD 等文档统一为 Gemini 2.5 Flash 识别词表。  
  - 验证：`npm run dev` 下上传词表图片并确认 `/api/vlm/extract` 返回 `words` 列表，无解码报错。  
- **2025-11-10 分段生成上线**  
  - `POST /api/generation/session` 仅等待第一大题即可返回，服务器后台串行生成第二/三大题，并提供 `GET /session/:id`、`POST /session/:id/retry` 追踪/重试。  
  - `usePracticeStore` 记录 SessionId、各题型状态与估算题量；`QuizPage` 实时轮询补齐题库，显示等待/错误提示并允许重试。  
  - 旧的 `/generation/super-json` 仍留作兼容，但默认流程已迁移。调试时务必覆盖“等待下一大题”和“生成失败后重试”场景。
- **2025-11-09 稳定版本**  
  - 根 `.env` 成为唯一配置源，`OPENROUTER_PROXY`/`VITE_MAX_VLM_IMAGES` 统一驱动客户端与服务端。  
  - 所有 OpenRouter 请求统一由 `server/src/services/openrouter.ts` 注入 ProxyAgent；上传图片数量限制在前后端同步校验。  
  - 移除 `ImageTest/` 与 `ExtractTest/` 实验脚本，避免提示词和依赖重复。  
  - Vite 通过 `envDir: '../'` 读取根变量，文档同步升级至 React 19 + Gemini 2.5 Flash。
- **2025-11-08 稳定版本**  
  - `CLIENT_ORIGINS` 支持多端口，CORS 不再因 Vite 自动换端口失败。  
  - 所有 OpenRouter 请求都走 `undici` 的 `ProxyAgent`，需要本地 7890 代理保持开启。  
  - 题库生成使用 Gemini → Grok-4 Fast → Moonshot → Polaris 的多级降级策略，并在三大题型内部执行 Fisher–Yates 打乱。  
  - 新增 `PROJECT_BOARD.md` 作为项目看板，请在重大调整后同步更新。  
  - `server/tsconfig.json` 仅编译 `src/**/*`，避免脚本目录触发 rootDir 报错。

> 规则：只要做了影响代理、模型、题库、CORS 或流程的改动，务必把变更写进 `PROJECT_BOARD.md`、`AGENTS.md`、`CLAUDE.md`，并说明验证方式。

## Key Files Reference
- Frontend routing: `client/src/App.tsx`
- Auth state: `client/src/store/useAuthStore.ts`
- Practice state: `client/src/store/usePracticeStore.ts`
- API client: `client/src/lib/api.ts`
- Types: `client/src/types/index.ts`
- Server bootstrap: `server/src/index.ts`
- OpenRouter integration: `server/src/services/openrouter.ts`
- Question generation: `server/src/services/superGenerator.ts`
- Database: `server/src/db/client.ts`
- Environment example: `.env.example`
