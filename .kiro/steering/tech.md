# Tech Stack

## 前端 (client/)

- **框架**: React 19 + TypeScript
- **构建**: Vite 7
- **路由**: React Router 7
- **状态管理**: Zustand
- **HTTP**: Axios
- **图标**: Lucide React

## 后端 (server/)

- **运行时**: Node.js 18+
- **框架**: Express 5
- **数据库**: SQLite (better-sqlite3)
- **验证**: Zod
- **认证**: JWT (jsonwebtoken + bcryptjs)
- **日志**: Winston
- **代理**: undici ProxyAgent

## AI 模型 (via OpenRouter)

- **VLM**: `google/gemini-2.5-flash-preview-09-2025` — 图片词汇提取
- **LLM**: 多模型降级策略 (Gemini → Grok-4 Fast → Moonshot → Polaris Alpha)

## 测试

- **前端单测**: Vitest + React Testing Library (90% 覆盖率阈值)
- **后端单测**: Vitest + better-sqlite3 临时数据库
- **E2E**: Playwright

## 常用命令

```bash
# 开发
npm run dev              # 全栈启动 (API :4000, Vite :5173)
npm run dev:client       # 仅前端
npm run dev:server       # 仅后端

# 构建
npm run build            # 编译 server + client

# 代码质量
npm run lint --workspace=client
npm run typecheck --workspace=server

# 测试
npm run test --workspace=client
npm run test --workspace=server
npm run test:coverage --workspace=client
npm run test:coverage --workspace=server
npm run test:e2e         # Playwright 端到端

# 注意：切换 Node 版本后需重新编译 better-sqlite3
npm rebuild --workspace=server better-sqlite3
```

## 环境配置

仅使用根目录 `.env`（复制 `.env.example`），Vite 通过 `envDir: '../'` 读取同一份配置。

关键变量：
- `OPENROUTER_API_KEY` — OpenRouter API 密钥
- `OPENROUTER_PROXY` — 代理地址（中国大陆必需）
- `JWT_SECRET` — JWT 签名密钥
- `VITE_MAX_VLM_IMAGES` — 最大上传图片数
- `CLIENT_ORIGINS` — 允许的前端域名
