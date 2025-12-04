# Design Document: Quiz Wrong Answer Review & Retry

## Overview

本功能为 Quiz 模块增加错题回顾和重练能力。用户完成练习后可在 ReportPage 查看错题详情，并通过"重练错题"按钮使用错题重新练习，无需调用生成 API。

核心设计原则：
1. **状态隔离** - 重练状态与原 session 分离，避免数据污染
2. **复用优先** - 最大化复用现有组件（QuizPage、SectionProgressCapsules）
3. **最小改动** - 仅修改必要文件，保持代码简洁

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      ReportPage                              │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │  Score Display  │  │     WrongAnswerList (new)       │   │
│  └─────────────────┘  │  - Question prompt              │   │
│                       │  - Correct answer               │   │
│                       │  - User's answer                │   │
│                       │  - Hint (if available)          │   │
│                       └─────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Action Buttons                          │   │
│  │  [返回主界面]  [针对错题强化练习]  [重练错题 (new)]  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Click "重练错题"
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      QuizPage (Retry Mode)                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Progress: "错题重练 · 第 X / Y 题"                  │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Question Card (reused)                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Complete retry
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   ReportPage (Retry Results)                 │
│  - Shows retry score                                        │
│  - Shows remaining wrong answers (if any)                   │
│  - Options: [返回原报告] [继续重练]                         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. WrongAnswerList (新组件)

```typescript
// client/src/components/WrongAnswerList.tsx
interface WrongAnswerItem {
  question: SuperQuestion;
  userAnswer: string;        // 用户选择的文本或输入
  correctAnswer: string;     // 正确答案文本
}

interface WrongAnswerListProps {
  items: WrongAnswerItem[];
}
```

职责：
- 渲染错题列表，每项显示题干、正确答案、用户作答、提示
- 使用 SECTION_LABELS 显示题型标签
- 无错题时显示"本轮全对"提示

### 2. usePracticeStore 扩展

新增状态字段：
```typescript
interface PracticeState {
  // ... existing fields
  
  // Retry mode fields
  isRetryMode: boolean;
  retryQuestions: SuperQuestion[];      // 重练题目列表
  retryAnswers: AnswerRecord[];         // 重练答题记录
  originalLastResult?: PracticeState['lastResult'];  // 保存原始结果
}
```

新增 actions：
```typescript
interface PracticeActions {
  // ... existing actions
  
  startRetryPractice: (wrongQuestions: SuperQuestion[]) => void;
  recordRetryAnswer: (answer: AnswerRecord) => void;
  setRetryResult: (result: PracticeState['lastResult']) => void;
  exitRetryMode: () => void;
}
```

### 3. ReportPage 修改

- 新增 WrongAnswerList 组件渲染
- 新增"重练错题"按钮
- 根据 isRetryMode 显示不同的 UI（原始报告 vs 重练报告）

### 4. QuizPage 修改

- 检测 isRetryMode，使用 retryQuestions 替代 superJson 队列
- 进度标签显示"错题重练"
- 完成时调用 setRetryResult 而非 setLastResult

## Data Models

### WrongAnswerItem

```typescript
interface WrongAnswerItem {
  question: SuperQuestion;   // 原始题目数据
  userAnswer: string;        // 用户作答（选项文本或输入文本）
  correctAnswer: string;     // 正确答案文本
}
```

### 辅助函数

```typescript
// client/src/lib/wrongAnswers.ts

/**
 * 从答题记录和题目数据中提取错题详情
 */
function extractWrongAnswers(
  answers: AnswerRecord[],
  superJson: SuperJson
): WrongAnswerItem[];

/**
 * 从错题详情中提取题目列表（用于重练）
 */
function getRetryQuestions(wrongItems: WrongAnswerItem[]): SuperQuestion[];
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Wrong answers display completeness
*For any* quiz session with wrong answers, the WrongAnswerList component SHALL display all and only the questions where the user's answer was incorrect, including the question prompt, correct answer, user's answer, and hint (if available).
**Validates: Requirements 1.1, 1.3, 1.4**

### Property 2: Question type labels consistency
*For any* wrong answer displayed, the type label SHALL match the corresponding value from SECTION_LABELS constant for that question type.
**Validates: Requirements 1.2, 5.3**

### Property 3: Retry button state correctness
*For any* quiz result, the "重练错题" button SHALL be enabled if and only if there exists at least one wrong answer in the session.
**Validates: Requirements 2.1, 2.2**

### Property 4: Retry questions isolation
*For any* retry practice session, the retryQuestions array SHALL contain exactly the questions that were answered incorrectly, and the original superJson SHALL remain unchanged.
**Validates: Requirements 2.3, 2.5, 4.1**

### Property 5: Retry mode flag correctness
*For any* practice session, the isRetryMode flag SHALL be true if and only if the user is currently in a retry practice round.
**Validates: Requirements 3.4, 4.4**

### Property 6: Retry completion allows re-retry
*For any* completed retry session with remaining wrong answers, the system SHALL allow starting another retry with only the newly wrong questions.
**Validates: Requirements 3.3**

### Property 7: State cleanup on exit
*For any* retry session, when the user exits retry mode, the retry-specific state (retryQuestions, retryAnswers, isRetryMode) SHALL be reset to initial values.
**Validates: Requirements 4.3**

## Error Handling

| 场景 | 处理方式 |
|------|----------|
| 无错题点击重练 | 按钮禁用，显示"本轮全对，暂无可重练题目" |
| 重练中途退出 | 清理重练状态，返回原报告页 |
| 重练完成全对 | 显示"恭喜！错题已全部掌握" |

## Testing Strategy

### 单元测试 (Vitest + React Testing Library)

1. **WrongAnswerList 组件测试**
   - 渲染错题列表（不同题型）
   - 无错题时显示提示
   - 正确显示题型标签

2. **wrongAnswers.ts 工具函数测试**
   - extractWrongAnswers 正确提取错题
   - getRetryQuestions 正确返回题目列表

3. **usePracticeStore 重练状态测试**
   - startRetryPractice 正确设置状态
   - recordRetryAnswer 正确记录答案
   - exitRetryMode 正确清理状态

4. **ReportPage 重练流程测试**
   - 有错题时按钮启用
   - 无错题时按钮禁用
   - 点击重练按钮触发正确状态变化

### 属性测试 (Property-Based Testing with fast-check)

使用 `fast-check` 库进行属性测试：

1. **Property 1**: 生成随机答题记录，验证 extractWrongAnswers 只返回错误答案
2. **Property 3**: 生成随机答题结果，验证按钮状态与错题存在性一致
3. **Property 4**: 生成随机错题列表，验证 startRetryPractice 后状态隔离
4. **Property 7**: 生成随机重练状态，验证 exitRetryMode 后状态清理

### 测试文件结构

```
client/src/
├── components/
│   └── __tests__/
│       └── WrongAnswerList.spec.tsx
├── lib/
│   └── __tests__/
│       └── wrongAnswers.spec.ts
└── __tests__/
    └── ReportPage.spec.tsx (扩展)
```
