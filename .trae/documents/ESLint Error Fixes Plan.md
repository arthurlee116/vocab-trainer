# ESLint Error Fixes Plan

## Overview
Fix 24 ESLint errors across multiple categories: unused eslint-disable directives, TypeScript `any` types, and unused variables.

## 1. Coverage Files (6 warnings - LOW priority)
**Files:** `coverage/**/*.js` (block-navigation.js, prettify.js, sorter.js)
**Issue:** Unused eslint-disable directives at line 1
**Solution:** Remove `/* eslint-disable */` comments from these generated coverage files

## 2. TypeScript `any` Type Errors (5 errors - HIGH priority)
**Files:**
- `src/__tests__/QuizPage.spec.tsx:1084` - Mock implementation with `any` types
- `src/lib/__tests__/tts.spec.ts:24,28,61` - Mock SpeechSynthesisUtterance and error handlers

**Solution:** Replace `any` with proper TypeScript types:
- Use `jest.Mock` or `vi.Mock` for mocked functions
- Use `SpeechSynthesisErrorEvent` for error parameters
- Use `unknown` instead of `any` where appropriate

## 3. Unused Variables in Test Files (4 errors - MEDIUM priority)
**Files:**
- `src/components/__tests__/WrongAnswerList.property.spec.tsx:8` - unused `screen`
- `src/pages/__tests__/HistoryPage.property.spec.tsx:8,132,133,239` - unused `screen`, `hasClockIcon`, `hasCheckIcon`, `completedCount`
- `src/pages/__tests__/ReportPage.spec.tsx:11` - unused `createMockType3Question`

**Solution:** Remove unused imports and variables

## 4. Unused Variables in Library Files (8 errors - MEDIUM priority)
**Files:**
- `src/lib/__tests__/storage.property.spec.ts:16,95` - unused `STORAGE_KEYS`, `analysisSummaryArb`
- `src/lib/__tests__/wrongAnswers.property.spec.ts:68` - unused `answerForQuestionArb`
- `src/lib/sentenceMask.ts:19,36,39,40` - unused constants `IRREGULAR_PARTICIPLES`, `SB_TOKENS`, `OBJ_PRONOUNS`, `POSSESSIVE_PRONOUNS`
- `src/lib/tts.ts:1,61,77,84` - unused `VoiceLang`, `reject`, error parameters `e`
- `src/lib/wrongAnswers.ts:1` - unused `QuestionType`

**Solution:** Remove unused imports and variables, or use underscore prefix for intentionally unused parameters

## 5. Unused Variables in Page Components (3 errors - MEDIUM priority)
**Files:**
- `src/pages/HistoryPage.tsx:4` - unused `Trophy` import
- `src/pages/QuizPage.tsx:250` - unused `err` parameter
- `src/pages/ReportPage.tsx:17` - unused `originalLastResult`

**Solution:** Remove unused imports and use underscore prefix for unused parameters

## Execution Order
1. Fix high-priority TypeScript `any` errors first
2. Fix medium-priority unused variables in source code
3. Fix medium-priority unused variables in test files  
4. Fix low-priority coverage file warnings

## Testing
After fixes, run `npm run lint` to verify all errors are resolved.