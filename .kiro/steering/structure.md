# Project Structure

采用 npm workspaces 管理前后端分离架构。

```
vocab-new/
├── .env                    # 唯一环境配置（前后端共享）
├── .env.example            # 环境变量模板
├── package.json            # 根配置，定义 workspaces
├── playwright.config.ts    # E2E 测试配置
│
├── client/                 # React SPA 前端
│   ├── src/
│   │   ├── pages/          # 页面组件 (PascalCase)
│   │   │   ├── LandingPage.tsx
│   │   │   ├── UploadPage.tsx
│   │   │   ├── ConfirmWordsPage.tsx
│   │   │   ├── VocabularyDetailsPage.tsx
│   │   │   ├── QuizPage.tsx
│   │   │   ├── ReportPage.tsx
│   │   │   └── HistoryPage.tsx
│   │   ├── components/     # 共享 UI 组件
│   │   ├── store/          # Zustand 状态管理
│   │   │   ├── useAuthStore.ts
│   │   │   └── usePracticeStore.ts
│   │   ├── hooks/          # 自定义 hooks
│   │   ├── lib/            # 工具函数、API 客户端
│   │   ├── types/          # TypeScript 类型定义
│   │   ├── constants/      # 常量配置
│   │   └── __tests__/      # 组件测试
│   ├── vite.config.ts
│   └── vitest.config.ts
│
├── server/                 # Express API 后端
│   ├── src/
│   │   ├── index.ts        # 入口
│   │   ├── routes/         # API 路由 (kebab-case)
│   │   ├── services/       # 业务逻辑
│   │   │   ├── vlm.ts              # VLM 图片识别
│   │   │   ├── superGenerator.ts   # 题目生成
│   │   │   ├── vocab-details.ts    # 词汇详情
│   │   │   ├── analysis.ts         # 分析报告
│   │   │   ├── auth.ts             # 认证
│   │   │   ├── history.ts          # 历史记录
│   │   │   └── openrouter.ts       # OpenRouter 客户端
│   │   ├── middleware/     # Express 中间件
│   │   ├── db/             # SQLite 数据库客户端
│   │   ├── config/         # 环境配置
│   │   ├── utils/          # 工具函数
│   │   └── types/          # 类型定义
│   ├── storage/            # SQLite 数据库文件
│   └── tsconfig.json
│
└── e2e/                    # Playwright E2E 测试
    └── landing.spec.ts
```

## 命名约定

- **前端组件/hooks/stores**: PascalCase (`QuizPage.tsx`, `useAuthStore.ts`)
- **后端模块**: kebab-case (`vlm-router.ts`, `super-generator.ts`)
- **测试文件**: `*.spec.ts` 或 `*.spec.tsx`

## 关键路径

| 功能 | 前端 | 后端 |
|------|------|------|
| 图片上传 | `UploadPage.tsx` | `/api/vlm/extract` |
| 题库生成 | `usePracticeStore.ts` | `/api/generation/session` |
| 词汇详情 | `VocabularyDetailsPage.tsx` | `/api/generation/details` |
| 练习答题 | `QuizPage.tsx` | — |
| 分析报告 | `ReportPage.tsx` | `/api/analysis/report` |
| 历史记录 | `HistoryPage.tsx` | `/api/history` |
