# Project Board — VOCAB NEW

> 稳定版本：2025-11-08（代理修复 + 题库随机 + 多模型降级）

## 1. 当前概况
- **产品定位**：AI 驱动的词汇练习，用 VLM 识别词表 → LLM 生成题库 → 练习 + 分析。
- **工作区**：前端 `client/`（React + Vite），后端 `server/`（Express + SQLite），共享 `.env` 控制 OpenRouter。
- **环境命令**：`npm run dev`（全栈）、`npm run dev:client`、`npm run dev:server`、`npm run build`、`npm run typecheck --workspace=server`、`npm run lint --workspace=client`。

### 近期关键修复
- **VLM 代理**：`server/src/services/vlm.ts` + `openrouter.ts` 统一使用 `undici ProxyAgent`，确保在大陆网络稳定访问 GPT-5 mini。
- **多域名 CORS**：`CLIENT_ORIGINS` 支持 5173-5176 多端口，避免前端端口变化造成上传失败。
- **题库随机化**：`superGenerator` 在每个题型内部执行 Fisher–Yates 打乱，避免题目顺序与单词表一致。
- **模型降级链**：题库生成优先 `moonshotai/kimi-linear-48b-a3b-instruct`，失败依次尝试 `google/gemini-2.5-flash-preview-09-2025` 与 `openrouter/polaris-alpha`。
- **类型修复**：`server/tsconfig.json` 限定 `src/**/*`，`shuffleWithin` 避免 `T | undefined` 警告。

## 2. 目录速览

| 目录 | 作用 |
| --- | --- |
| `client/` | Vite React 前端，`src/pages` 页面、`src/store` Zustand、`src/lib` API/文件工具。 |
| `server/` | Express API，`src/routes` REST 接口，`src/services` 对接 OpenRouter / GPT-5，`src/db` SQLite。 |
| `ImageTest/`、`ExtractTest/` | 离线实验脚本与结果（非生产）。 |
| `OpenRouter Files/` | 对 OpenRouter 文档的快速引用。 |
| `PROJECT_BOARD.md` | 当前文件，用于记录概况与最新变更。 |
| `AGENTS.md` / `CLAUDE.md` | 协作者（AI/人）操作守则，必须更新重大修改。 |

## 3. 关键工作流
1. **图片上传**：`UploadPage` → `filesToBase64Array` → POST `/api/vlm/extract`。
2. **词表确认**：`ConfirmWordsPage` → POST `/api/generation/super-json` → 保存到 `usePracticeStore`。
3. **练习**：`QuizPage` 根据题型顺序渲染；每个题型内部题目已打乱。
4. **结果分析**：POST `/api/analysis/report` → 显示分析并可保存历史。
5. **历史**：`/api/history` CRUD + SQLite `sessions` 表。

## 4. 当前稳定版本（2025-11-08）
- ✅ 图片识别可通过代理成功调用 GPT-5 mini。
- ✅ 5173-5176 任意端口都允许访问 API。
- ✅ 题库生成具备三层模型降级 + 每题型随机顺序。
- ✅ `server` `tsc --noEmit` 通过；`npm run dev` 手动烟测 `/practice` 流程通过。

## 5. 待跟进 / 观察
- ⏳ `better-sqlite3` 与 Node 版本需保持一致；更换 Node 后必须 `npm rebuild --workspace=server`。
- ⏳ 仍缺少自动化测试，可按 `client/src/__tests__` / `server/src/__tests__` 模板补齐。
- ⏳ OpenRouter 某些模型（例如 Stealth）偶发 4xx，需要继续观察是否要加入更多降级模型或错误提示。

## 6. 记录规范
- 任何重要修复、依赖升级或跨目录改动必须同步更新 `PROJECT_BOARD.md`、`AGENTS.md`、`CLAUDE.md`。
- 若引入新的外部脚本 / 实验目录，请在“目录速览”表中说明是否生产可用。
- 发布新的稳定版本时，在“当前稳定版本”段落追加日期与验证结果。
