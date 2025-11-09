# Repository Guidelines

## Project Structure & Module Organization
Workspaces split the React SPA under `client/` and the Express API under `server/`. UI code sits in `client/src` with `pages/`, `components/`, `store/`, and `lib/` folders so routing, shared UI, state, and helpers stay separated. Server handlers live in `server/src`, while SQLite data and migration helpers stay in `server/storage/`.

## Build, Test, and Development Commands
- `npm run dev` — starts both workspaces (API on :4000, Vite on :5173) for full-stack testing.
- `npm run dev:client` / `npm run dev:server` — quicker feedback when touching only UI or API code.
- `npm run build` — runs `tsc` for the server and `vite build` for the client; fails fast if `.env` is missing required keys.
- `npm run lint --workspace=client` — ESLint + TypeScript rules for React; run before you push.
- `npm run typecheck --workspace=server` — validates request/response types without emitting JS.

## Coding Style & Naming Conventions
Stick to TypeScript, 2-space indentation, and single quotes to match the existing files. Components, hooks, and Zustand stores use PascalCase filenames (`QuizPage.tsx`, `useAuthStore.ts`), while backend modules favor kebab-case (`vlm-router.ts`). Keep logic near its consumer, export strongly typed functions, and validate external data with `zod` before returning it through `/api/*` routes.

## Testing Guidelines
No automated suite exists yet, so bootstrap Vitest + React Testing Library under `client/src/__tests__/ComponentName.spec.tsx` and mock Zustand stores when needed. Server units can use plain Vitest or Jest inside `server/src/__tests__/`, focusing on validators and SQLite writes. Each feature should land with at least one happy path test plus an error branch, and manual smoke tests of the `/practice` flow via `npm run dev` remain mandatory until CI is in place.

## Commit & Pull Request Guidelines
History follows Conventional Commits (`chore(project): …`), so keep using `<type>(scope): summary` with present-tense English. Submit focused commits (UI vs API vs infra) and list validation steps in the PR description (`npm run lint`, manual quiz run, screenshots). Link related issues, note data migrations, and double-check that secrets remain in `.env` rather than source files.

## Security & Configuration Tips
Copy the repository root `.env.example` to `.env` (root only), fill in real API keys, and keep the file out of Git. Define `CLIENT_ORIGINS` with every allowed frontend URL, configure `OPENROUTER_PROXY` if you need a local proxy, and keep shared limits such as `VITE_MAX_VLM_IMAGES` in this same file. Scrub vocab screenshots or AI transcripts before posting them outside the team.

## Collaboration Log
- **2025-11-11**  
  - VLM 词表提取统一使用 `openai/gpt-5-mini`（带 ProxyAgent），`/api/vlm/extract`、文档与说明已同步说明 GPT-5 mini 作为 VLM 模型。  
  - 验证：`npm run dev` 并上传样例词表图片，确保 `/api/vlm/extract` 返回标准格式词表与对应日志。  
- **2025-11-10**  
  - 题库改为 Session 化的分段生成：新增 `/api/generation/session`/`GET session/:id`/`POST session/:id/retry`，一次只等待第一大题，其余题型后台串行生成。
  - `usePracticeStore` 记录 sessionId、每大题状态与估算题量，Quiz 页面轮询补齐题目、展示进度/错误并允许重试。
  - Confirm→Quiz 整个流已依赖新 Session API，旧的 `/super-json` 仅作兼容备用。记得测试“等待/失败重试”路径并在 PR 里说明验证方法。
- **2025-11-09**  
  - 合并根 `.env` 为唯一配置源，新增 `OPENROUTER_PROXY`/`VITE_MAX_VLM_IMAGES`，并让所有 OpenRouter 请求强制走代理。  
  - 删除 `ImageTest/` 与 `ExtractTest/` 实验目录，避免重复提示词与依赖。  
  - Vite 通过 `envDir: '../'` 直接读取根环境变量；CORS 限制统一读取 `CLIENT_ORIGINS`。  
  - 文档更新为 React 19 + GPT-5 mini，上传图片数量配置与后端校验保持一致。
- **2025-11-08**  
  - 增加 `CLIENT_ORIGINS` 支持 5173-5176，解决 Vite 端口变化造成的 CORS 无日志失败。  
  - `server/src/services/vlm.ts` + `openrouter.ts` 使用 `undici` 的 `ProxyAgent`，确保在中国大陆网络通过本地代理访问 GPT-5 mini。  
  - `superGenerator` 新增 `moonshotai/kimi-linear-48b-a3b-instruct → google/gemini-2.5-flash-preview-09-2025 → openrouter/polaris-alpha` 多模型降级，并在题型内部随机题目顺序。  
  - 新增 `PROJECT_BOARD.md` 记录项目概况、稳定版本与未来任务。  
  - `server/tsconfig.json` 限定编译源为 `src/**/*`，消除脚本目录的 rootDir 警告。

> 以后每次重要修复或流程调整，都要同步更新 `PROJECT_BOARD.md`、本文件与 `CLAUDE.md`，确保下一位协作者能立即了解最新状态。

所有的回复请全部使用中文！！
