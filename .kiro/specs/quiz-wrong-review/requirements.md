# Requirements Document

## Introduction

本功能为 AI 词汇训练平台的 Quiz 模块增加"错词回顾 + 一键重练错题"能力。用户完成一轮 Quiz 后，可以在完成页面查看本轮错题详情（题干、正确答案、用户作答、提示），并通过"重练错题"按钮使用当前 session 内的错题重新开始一轮练习，无需重新请求生成接口。

## Glossary

- **Quiz**: 词汇练习模块，包含三种题型（英译中选择、中译英选择、句子填空）
- **Session**: 一次完整的练习会话，包含题目、答案记录和分析结果
- **错题 (Wrong Answer)**: 用户作答错误的题目
- **重练 (Retry Practice)**: 使用错题重新开始一轮练习
- **usePracticeStore**: Zustand 状态管理 store，管理练习相关状态
- **ReportPage**: 练习完成后的报告页面
- **SuperQuestion**: 题目数据结构，包含题干、选项、正确答案等信息
- **AnswerRecord**: 用户答题记录，包含题目 ID、用户选择/输入、是否正确等

## Requirements

### Requirement 1

**User Story:** As a learner, I want to review my wrong answers after completing a quiz, so that I can understand my mistakes and learn from them.

#### Acceptance Criteria

1. WHEN a user completes a quiz session THEN the ReportPage SHALL display a list of wrong answers including question prompt, correct answer, user's answer, and hint (if available)
2. WHEN the wrong answer list is displayed THEN the system SHALL show the question type label for each wrong answer
3. WHEN a wrong answer is from a choice-based question (type 1 or 2) THEN the system SHALL display both the correct choice text and the user's selected choice text
4. WHEN a wrong answer is from a fill-in-the-blank question (type 3) THEN the system SHALL display the correct answer and the user's input text
5. WHEN there are no wrong answers THEN the system SHALL display a congratulatory message indicating perfect score

### Requirement 2

**User Story:** As a learner, I want to retry only the questions I got wrong, so that I can focus my practice on areas where I need improvement.

#### Acceptance Criteria

1. WHEN wrong answers exist THEN the ReportPage SHALL display an enabled "重练错题" (Retry Wrong) button
2. WHEN no wrong answers exist THEN the system SHALL display a disabled "重练错题" button with a tooltip or message explaining why
3. WHEN a user clicks the "重练错题" button THEN the system SHALL start a new practice round using only the wrong questions from the current session
4. WHEN starting a retry practice THEN the system SHALL NOT make any new API calls to generate questions
5. WHEN starting a retry practice THEN the system SHALL preserve the original session data and create a separate retry state

### Requirement 3

**User Story:** As a learner, I want to complete a retry practice round and see my updated results, so that I can track my improvement.

#### Acceptance Criteria

1. WHEN a user completes a retry practice round THEN the system SHALL display the retry results separately from the original session results
2. WHEN all retry questions are answered correctly THEN the system SHALL display a success message indicating mastery
3. WHEN some retry questions are still wrong THEN the system SHALL allow the user to retry again with the remaining wrong questions
4. WHEN a retry practice is in progress THEN the system SHALL clearly indicate that this is a retry session (not a new session)

### Requirement 4

**User Story:** As a developer, I want the retry practice state to be properly managed, so that the original session data is not corrupted.

#### Acceptance Criteria

1. WHEN a retry practice starts THEN the usePracticeStore SHALL store the retry questions separately from the original superJson
2. WHEN a retry practice ends THEN the system SHALL allow the user to return to the original report or start another retry
3. WHEN the user navigates away from retry practice THEN the system SHALL properly clean up retry-specific state
4. WHEN storing retry state THEN the system SHALL include a flag to distinguish retry mode from normal practice mode

### Requirement 5

**User Story:** As a user, I want the wrong answer review UI to be consistent with the existing Quiz design, so that I have a seamless experience.

#### Acceptance Criteria

1. WHEN displaying wrong answers THEN the UI SHALL use the same styling patterns as the existing Quiz and Report pages
2. WHEN displaying wrong answers THEN the system SHALL use responsive design that works on mobile and desktop
3. WHEN displaying question type labels THEN the system SHALL use the existing SECTION_LABELS constants
