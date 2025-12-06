/**
 * Property-based tests for usePracticeStore session resume functionality
 * **Feature: session-resume, Property 6: Session Resumption Integrity**
 * **Validates: Requirements 3.3, 3.4, 3.5**
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { usePracticeStore } from '../usePracticeStore';
import type {
  SuperQuestion,
  QuestionType,
  AnswerRecord,
  AnalysisSummary,
  SessionSnapshot,
  SuperJson,
  DifficultyLevel,
} from '../../types';

// Reset store before each test
beforeEach(() => {
  usePracticeStore.setState({
    words: [],
    images: [],
    answers: [],
    status: 'idle',
    sectionStatus: {
      questions_type_1: 'pending',
      questions_type_2: 'pending',
      questions_type_3: 'pending',
    },
    sectionErrors: {
      questions_type_1: undefined,
      questions_type_2: undefined,
      questions_type_3: undefined,
    },
    detailsStatus: 'idle',
    isRetryMode: false,
    retryQuestions: [],
    retryAnswers: [],
    originalLastResult: undefined,
    superJson: undefined,
    lastResult: undefined,
    historySessionId: undefined,
    currentQuestionIndex: 0,
    isResumedSession: false,
  });
});

// Arbitrary for generating a unique ID
const idArb = fc.uuid();

// Arbitrary for generating a difficulty level
const difficultyArb: fc.Arbitrary<DifficultyLevel> = fc.constantFrom('beginner', 'intermediate', 'advanced');

// Arbitrary for generating a SuperQuestion
const superQuestionArb: fc.Arbitrary<SuperQuestion> = fc.record({
  id: idArb,
  word: fc.string({ minLength: 1, maxLength: 20 }),
  prompt: fc.string({ minLength: 1, maxLength: 100 }),
  choices: fc.array(
    fc.record({
      id: idArb,
      text: fc.string({ minLength: 1, maxLength: 50 }),
    }),
    { minLength: 2, maxLength: 4 }
  ),
  correctChoiceId: idArb,
  explanation: fc.string({ minLength: 0, maxLength: 200 }),
  type: fc.constantFrom('questions_type_1', 'questions_type_2', 'questions_type_3') as fc.Arbitrary<QuestionType>,
  hint: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
});

// Arbitrary for generating an AnswerRecord
const answerRecordArb: fc.Arbitrary<AnswerRecord> = fc.record({
  questionId: idArb,
  choiceId: fc.option(idArb, { nil: undefined }),
  userInput: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  correct: fc.boolean(),
  elapsedMs: fc.integer({ min: 100, max: 30000 }),
});

// Arbitrary for generating an AnalysisSummary
const analysisSummaryArb: fc.Arbitrary<AnalysisSummary> = fc.record({
  report: fc.string({ minLength: 1, maxLength: 500 }),
  recommendations: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
});

// Arbitrary for generating a valid ISO date string
const isoDateArb = fc
  .integer({ min: 0, max: Date.now() + 365 * 24 * 60 * 60 * 1000 })
  .map((ts) => new Date(ts).toISOString());

// Arbitrary for generating a SuperJson
const superJsonArb: fc.Arbitrary<SuperJson> = fc.record({
  metadata: fc.record({
    totalQuestions: fc.integer({ min: 1, max: 200 }),
    words: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 50 }),
    difficulty: difficultyArb,
    generatedAt: isoDateArb,
  }),
  questions_type_1: fc.array(superQuestionArb, { minLength: 0, maxLength: 20 }),
  questions_type_2: fc.array(superQuestionArb, { minLength: 0, maxLength: 20 }),
  questions_type_3: fc.array(superQuestionArb, { minLength: 0, maxLength: 20 }),
});

// Arbitrary for generating a SessionSnapshot for resume
const sessionSnapshotArb: fc.Arbitrary<SessionSnapshot> = fc
  .record({
    id: idArb,
    mode: fc.constantFrom('guest', 'authenticated') as fc.Arbitrary<'guest' | 'authenticated'>,
    userId: fc.option(idArb, { nil: undefined }),
    difficulty: difficultyArb,
    words: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 50 }),
    score: fc.integer({ min: 0, max: 100 }),
    analysis: analysisSummaryArb,
    superJson: superJsonArb,
    answers: fc.array(answerRecordArb, { minLength: 0, maxLength: 50 }),
    createdAt: isoDateArb,
    status: fc.constantFrom('in_progress', 'completed') as fc.Arbitrary<'in_progress' | 'completed'>,
    currentQuestionIndex: fc.integer({ min: 0, max: 100 }),
    updatedAt: isoDateArb,
  })
  .filter((s) => s.currentQuestionIndex <= s.answers.length + 50); // Ensure index is reasonable

describe('usePracticeStore Resume - Property Tests', () => {
  /**
   * **Feature: session-resume, Property 6: Session Resumption Integrity**
   * **Validates: Requirements 3.3, 3.4, 3.5**
   *
   * For any saved in-progress session, resuming SHALL restore:
   * (a) the correct currentQuestionIndex,
   * (b) the original question order (via superJson),
   * (c) all previously recorded answers.
   */
  describe('Property 6: Session Resumption Integrity', () => {
    it('resumeSession should restore currentQuestionIndex correctly', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property (a): currentQuestionIndex should match the session
          expect(state.currentQuestionIndex).toBe(session.currentQuestionIndex);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resumeSession should restore original question order via superJson', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property (b): superJson should be exactly the same as the session's superJson
          expect(state.superJson).toEqual(session.superJson);

          // Verify question order is preserved for each type
          expect(state.superJson?.questions_type_1).toEqual(session.superJson.questions_type_1);
          expect(state.superJson?.questions_type_2).toEqual(session.superJson.questions_type_2);
          expect(state.superJson?.questions_type_3).toEqual(session.superJson.questions_type_3);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resumeSession should restore all previously recorded answers', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property (c): answers should be exactly the same as the session's answers
          expect(state.answers).toEqual(session.answers);
          expect(state.answers.length).toBe(session.answers.length);

          // Verify each answer is preserved
          for (let i = 0; i < session.answers.length; i++) {
            expect(state.answers[i]).toEqual(session.answers[i]);
          }

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resumeSession should set isResumedSession flag to true', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Initial state: isResumedSession should be false
          expect(usePracticeStore.getState().isResumedSession).toBe(false);

          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property: isResumedSession should be true after resuming
          expect(state.isResumedSession).toBe(true);

          // Reset for next iteration
          usePracticeStore.setState({ isResumedSession: false });

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resumeSession should set historySessionId correctly', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property: historySessionId should match the session id
          expect(state.historySessionId).toBe(session.id);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resumeSession should restore difficulty and words', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property: difficulty should match
          expect(state.difficulty).toBe(session.difficulty);

          // Property: words should match
          expect(state.words).toEqual(session.words);

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resumeSession should set status to inProgress', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Setup: set status to something else
          usePracticeStore.setState({ status: 'idle' });

          // Action: resume session
          usePracticeStore.getState().resumeSession(session);

          const state = usePracticeStore.getState();

          // Property: status should be inProgress after resuming
          expect(state.status).toBe('inProgress');

          return true;
        }),
        { numRuns: 100 }
      );
    });

    it('resetSession should clear all resume-related state', () => {
      fc.assert(
        fc.property(sessionSnapshotArb, (session) => {
          // Setup: resume a session first
          usePracticeStore.getState().resumeSession(session);

          // Verify resume state is set
          expect(usePracticeStore.getState().isResumedSession).toBe(true);
          expect(usePracticeStore.getState().historySessionId).toBe(session.id);

          // Action: reset session
          usePracticeStore.getState().resetSession();

          const state = usePracticeStore.getState();

          // Property: all resume state should be cleared
          expect(state.historySessionId).toBeUndefined();
          expect(state.currentQuestionIndex).toBe(0);
          expect(state.isResumedSession).toBe(false);
          expect(state.answers).toEqual([]);
          expect(state.superJson).toBeUndefined();

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('initializeHistorySession', () => {
    it('should set historySessionId and reset resume flags', () => {
      fc.assert(
        fc.property(idArb, (sessionId) => {
          // Action: initialize history session
          usePracticeStore.getState().initializeHistorySession(sessionId);

          const state = usePracticeStore.getState();

          // Property: historySessionId should be set
          expect(state.historySessionId).toBe(sessionId);

          // Property: currentQuestionIndex should be 0
          expect(state.currentQuestionIndex).toBe(0);

          // Property: isResumedSession should be false (this is a new session)
          expect(state.isResumedSession).toBe(false);

          return true;
        }),
        { numRuns: 100 }
      );
    });
  });
});
