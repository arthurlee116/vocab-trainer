# Project Board — VOCAB NEW

> 稳定版本：2025-11-09（单一 .env + 统一代理 + 上传限制同步）

## 1. 当前概况
- **产品定位**：AI 驱动的词汇练习，用 VLM 识别词表 → LLM 生成题库 → 练习 + 分析。
- **工作区**：前端 `client/`（React + Vite），后端 `server/`（Express + SQLite），共享 `.env` 控制 OpenRouter。
- **环境命令**：`npm run dev`（全栈）、`npm run dev:client`、`npm run dev:server`、`npm run build`、`npm run typecheck --workspace=server`、`npm run lint --workspace=client`。

### 近期关键修复
- **句子遮挡双保险（2025-02-14）**：superGenerator 提示词要求先用 `[BLANK]...[/BLANK]` 包裹待考短语再改成 `_____`，translation/hint 禁止泄露；Quiz 前端先检测 sentence 是否已有 `_____`，如无则按答案首词（含 be/have/do 及常规时态）生成多种匹配模式动态遮挡，兼容旧 Session。
- **单一环境文件**：仅允许根 `.env`，新增 `OPENROUTER_PROXY`、`VITE_MAX_VLM_IMAGES`，Vite 借助 `envDir: '../'` 与后端读取同一份配置。
- **统一代理**：`server/src/services/openrouter.ts` 默认挂载 `ProxyAgent`，VLM、题库与分析请求都走同一代理链路。
- **上传上限同步**：前端常量与 `/api/vlm/extract` 校验共享 `VITE_MAX_VLM_IMAGES`，避免“前端放行/后端拒绝”。
- **实验目录清理**：移除 `ImageTest/` 与 `ExtractTest/`，提示词与依赖全部以生产代码为准。
- **文档刷新**：README、AGENTS、CLAUDE 更新为 React 19 + Gemini 2.5 Flash，强调根 `.env`。 
- **VLM 识别**： `/api/vlm/extract` 使用 `google/gemini-2.5-flash-preview-09-2025` 并通过 ProxyAgent 请求；README、AGENTS、CLAUDE 已同步 Gemini 2.5 Flash 说明，手动上传词表验证接口返回标准 `words`。 
- **分段题库生成**：`/api/generation/session` 启动题库 Session，仅等待第一大题即可进入练习；第二、三大题在后台排队生成，支持状态查询与重试，前端 Quiz 轮询补充题目并更新进度。

## 2. 目录速览

| 目录 | 作用 |
| --- | --- |
| `client/` | Vite React 前端，`src/pages` 页面、`src/store` Zustand、`src/lib` API/文件工具。 |
| `server/` | Express API，`src/routes` REST 接口，`src/services` 对接 OpenRouter / Gemini 2.5 Flash，`src/db` SQLite。 |
| `OpenRouter Files/` | 对 OpenRouter 文档的快速引用。 |
| `PROJECT_BOARD.md` | 当前文件，用于记录概况与最新变更。 |
| `AGENTS.md` / `CLAUDE.md` | 协作者（AI/人）操作守则，必须更新重大修改。 |

## 3. 关键工作流
1. **图片上传**：`UploadPage` → `filesToBase64Array` → POST `/api/vlm/extract`。
2. **词表确认**：`ConfirmWordsPage` → POST `/api/generation/session`，立即拿到第一大题与 Session 信息，`usePracticeStore` 记录 sessionId/状态。
3. **练习**：`QuizPage` 轮询 `/api/generation/session/:id` 获取后续大题，显示生成状态/错误与重试按钮；题型仍按 1→2→3 顺序，内部题目打乱。
4. **结果分析**：POST `/api/analysis/report` → 显示分析并可保存历史。
5. **历史**：`/api/history` CRUD + SQLite `sessions` 表。

## 4. 当前稳定版本（2025-11-09）
- ✅ 根 `.env` + `envDir` 配置验证通过，前后端共享同一环境文件。
- ✅ 所有 OpenRouter 请求经统一代理测试通过（VLM、题库、分析）。
- ✅ 前后端上传图片上限一致（`VITE_MAX_VLM_IMAGES=5`），`/api/vlm/extract` 行为与 UI 提示匹配。
- ✅ `server` `tsc --noEmit` 通过；`npm run dev` 手动烟测 `/practice` 流程通过。

## 5. 待跟进 / 观察
- ⏳ `better-sqlite3` 与 Node 版本需保持一致；更换 Node 后必须 `npm rebuild --workspace=server`。
- ⏳ 仍缺少自动化测试，可按 `client/src/__tests__` / `server/src/__tests__` 模板补齐。
- ⏳ OpenRouter 某些模型（例如 Stealth）偶发 4xx，需要继续观察是否要加入更多降级模型或错误提示。

## 6. 记录规范
- 任何重要修复、依赖升级或跨目录改动必须同步更新 `PROJECT_BOARD.md`、`AGENTS.md`、`CLAUDE.md`。
- 若引入新的外部脚本 / 实验目录，请在“目录速览”表中说明是否生产可用。
- 发布新的稳定版本时，在“当前稳定版本”段落追加日期与验证结果。
