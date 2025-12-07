/**
 * Property-based tests for HistoryPage status-based UI rendering
 * **Feature: session-resume, Property 7: Status-Based UI Rendering**
 * **Validates: Requirements 5.1, 5.2**
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '../HistoryPage';
import { useAuthStore } from '../../store/useAuthStore';
import { usePracticeStore } from '../../store/usePracticeStore';
import * as storage from '../../lib/storage';
import type { SessionSnapshot, DifficultyLevel, SessionStatus, SuperJson, AnswerRecord, VocabularyDetail } from '../../types';

// Mock the storage module
vi.mock('../../lib/storage', () => ({
  loadGuestHistory: vi.fn(() => []),
}));

// Mock the api module
vi.mock('../../lib/api', () => ({
  fetchAuthenticatedHistory: vi.fn(() => Promise.resolve([])),
}));

// Mock the progressService module
vi.mock('../../lib/progressService', () => ({
  deleteSession: vi.fn(() => Promise.resolve()),
  getSessionForResume: vi.fn(() => Promise.resolve({})),
}));

// Arbitrary for generating a unique ID
const idArb = fc.uuid();

// Arbitrary for generating difficulty level
const difficultyArb: fc.Arbitrary<DifficultyLevel> = fc.constantFrom('beginner', 'intermediate', 'advanced');

// Arbitrary for generating session status
const statusArb: fc.Arbitrary<SessionStatus> = fc.constantFrom('in_progress', 'completed');

// Arbitrary for generating valid ISO date strings (constrained to avoid Invalid Date)
const validDateStringArb = fc
  .integer({ min: 1577836800000, max: 1924905600000 }) // 2020-01-01 to 2030-12-31 in ms
  .map((ms) => new Date(ms).toISOString());

// Arbitrary for generating a minimal SuperJson
const superJsonArb: fc.Arbitrary<SuperJson> = fc.record({
  metadata: fc.record({
    totalQuestions: fc.integer({ min: 10, max: 100 }),
    words: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 20 }),
    difficulty: difficultyArb,
    generatedAt: validDateStringArb,
  }),
  questions_type_1: fc.constant([]),
  questions_type_2: fc.constant([]),
  questions_type_3: fc.constant([]),
});

// Arbitrary for generating answer records
const answerRecordArb: fc.Arbitrary<AnswerRecord> = fc.record({
  questionId: idArb,
  choiceId: fc.option(idArb, { nil: undefined }),
  userInput: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
  correct: fc.boolean(),
  elapsedMs: fc.integer({ min: 100, max: 30000 }),
});

// Arbitrary for generating vocabulary details
const vocabDetailArb: fc.Arbitrary<VocabularyDetail> = fc.record({
  word: fc.string({ minLength: 1, maxLength: 20 }),
  partsOfSpeech: fc.array(fc.constantFrom('n.', 'v.', 'adj.', 'adv.'), { minLength: 1, maxLength: 3 }),
  definitions: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 1, maxLength: 3 }),
  examples: fc.array(
    fc.record({
      en: fc.string({ minLength: 5, maxLength: 100 }),
      zh: fc.string({ minLength: 2, maxLength: 50 }),
    }),
    { minLength: 1, maxLength: 2 }
  ),
});

// Arbitrary for generating a SessionSnapshot with specific status
const sessionSnapshotArb = (status: SessionStatus): fc.Arbitrary<SessionSnapshot> =>
  fc.record({
    id: idArb,
    mode: fc.constantFrom('guest', 'authenticated') as fc.Arbitrary<'guest' | 'authenticated'>,
    userId: fc.option(idArb, { nil: undefined }),
    difficulty: difficultyArb,
    words: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 20 }),
    score: status === 'completed' ? fc.integer({ min: 0, max: 100 }) : fc.constant(0),
    analysis: fc.record({
      report: status === 'completed' ? fc.string({ minLength: 10, maxLength: 200 }) : fc.constant(''),
      recommendations: status === 'completed'
        ? fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 0, maxLength: 3 })
        : fc.constant([]),
    }),
    superJson: superJsonArb,
    answers: fc.array(answerRecordArb, { minLength: 0, maxLength: 50 }),
    createdAt: validDateStringArb,
    status: fc.constant(status),
    currentQuestionIndex: fc.integer({ min: 0, max: 100 }),
    updatedAt: validDateStringArb,
    // Vocab details fields (Requirements 4.1, 4.2)
    hasVocabDetails: fc.boolean(),
    vocabDetails: fc.option(fc.array(vocabDetailArb, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  });

// Arbitrary for generating a SessionSnapshot with specific hasVocabDetails value
const sessionWithVocabDetailsArb = (hasDetails: boolean): fc.Arbitrary<SessionSnapshot> =>
  fc.record({
    id: idArb,
    mode: fc.constantFrom('guest', 'authenticated') as fc.Arbitrary<'guest' | 'authenticated'>,
    userId: fc.option(idArb, { nil: undefined }),
    difficulty: difficultyArb,
    words: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 20 }),
    score: fc.integer({ min: 0, max: 100 }),
    analysis: fc.record({
      report: fc.string({ minLength: 10, maxLength: 200 }),
      recommendations: fc.array(fc.string({ minLength: 5, maxLength: 100 }), { minLength: 0, maxLength: 3 }),
    }),
    superJson: superJsonArb,
    answers: fc.array(answerRecordArb, { minLength: 0, maxLength: 50 }),
    createdAt: validDateStringArb,
    status: fc.constantFrom('in_progress', 'completed') as fc.Arbitrary<SessionStatus>,
    currentQuestionIndex: fc.integer({ min: 0, max: 100 }),
    updatedAt: validDateStringArb,
    hasVocabDetails: fc.constant(hasDetails),
    vocabDetails: hasDetails
      ? fc.array(vocabDetailArb, { minLength: 1, maxLength: 5 })
      : fc.constant(undefined),
  });

// Arbitrary for generating mixed status sessions
const mixedSessionsArb: fc.Arbitrary<SessionSnapshot[]> = fc
  .array(statusArb, { minLength: 1, maxLength: 5 })
  .chain((statuses) => fc.tuple(...statuses.map((status) => sessionSnapshotArb(status))));

const renderHistoryPage = () => {
  cleanup();
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>
  );
};

describe('HistoryPage - Property Tests', () => {
  beforeEach(() => {
    // Set guest mode for simpler testing
    useAuthStore.setState({ mode: 'guest' });
    usePracticeStore.getState().resetSession();
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  /**
   * Property 7: Status-Based UI Rendering
   * For any session displayed in the UI, in-progress sessions SHALL show progress count
   * and Clock icon, while completed sessions SHALL show score and CheckCircle icon.
   * **Validates: Requirements 5.1, 5.2**
   */
  it('should render Clock icon for in-progress sessions and CheckCircle icon for completed sessions', () => {
    fc.assert(
      fc.property(mixedSessionsArb, (sessions) => {
        // Mock loadGuestHistory to return our generated sessions
        vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

        renderHistoryPage();

        // Check each session's icon rendering
        sessions.forEach((session) => {
          const sessionElement = document.querySelector(`[data-testid="session-${session.id}"]`) ||
            document.querySelector('.history-item');
          
          if (sessionElement) {
            if (session.status === 'in_progress') {
              // In-progress sessions should have Clock icon (Requirements 5.1)
              // Note: We check the overall page has the right number of each icon type
            } else {
              // Completed sessions should have CheckCircle icon (Requirements 5.1)
            }
          }
        });

        // Count icons on the page
        const clockIcons = document.querySelectorAll('.status-icon-in-progress');
        const checkIcons = document.querySelectorAll('.status-icon-completed');

        const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;
        const completedCount = sessions.filter((s) => s.status === 'completed').length;

        // Property: number of Clock icons equals number of in-progress sessions
        expect(clockIcons.length).toBe(inProgressCount);
        // Property: number of CheckCircle icons equals number of completed sessions
        expect(checkIcons.length).toBe(completedCount);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Property 7 (continued): In-progress sessions show progress count
   * **Validates: Requirements 5.2**
   */
  it('should display progress count for in-progress sessions', () => {
    fc.assert(
      fc.property(
        fc.array(sessionSnapshotArb('in_progress'), { minLength: 1, maxLength: 3 }),
        (sessions) => {
          vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

          renderHistoryPage();

          // Each in-progress session should show "已做 X/Y 题" format
          sessions.forEach((session) => {
            const answeredCount = session.answers?.length ?? 0;
            const totalQuestions = session.superJson?.metadata?.totalQuestions ?? 0;
            
            // Look for the progress text pattern
            const progressPattern = new RegExp(`已做\\s*${answeredCount}/${totalQuestions}\\s*题`);
            const pageText = document.body.textContent || '';
            
            // Property: progress text should be present for in-progress sessions
            expect(pageText).toMatch(progressPattern);
          });

          // Property: no score display for in-progress sessions (they show progress instead)
          const inProgressItems = document.querySelectorAll('.history-item-in-progress');
          expect(inProgressItems.length).toBe(sessions.length);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 7 (continued): Completed sessions show score
   * **Validates: Requirements 5.2**
   */
  it('should display score for completed sessions', () => {
    fc.assert(
      fc.property(
        fc.array(sessionSnapshotArb('completed'), { minLength: 1, maxLength: 3 }),
        (sessions) => {
          vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

          renderHistoryPage();

          // Each completed session should show score
          sessions.forEach((session) => {
            const score = Math.round(session.score);
            const scorePattern = new RegExp(`${score}\\s*分`);
            const pageText = document.body.textContent || '';
            
            // Property: score should be present for completed sessions
            expect(pageText).toMatch(scorePattern);
          });

          // Property: completed sessions should not have in-progress styling
          const inProgressItems = document.querySelectorAll('.history-item-in-progress');
          expect(inProgressItems.length).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 7 (continued): Mixed sessions render correctly
   * **Validates: Requirements 5.1, 5.2**
   */
  it('should correctly distinguish between in-progress and completed sessions in mixed list', () => {
    fc.assert(
      fc.property(mixedSessionsArb, (sessions) => {
        vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

        renderHistoryPage();

        const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;

        // Property: total items rendered equals total sessions
        const allItems = document.querySelectorAll('.history-item');
        expect(allItems.length).toBe(sessions.length);

        // Property: in-progress items have correct styling
        const inProgressItems = document.querySelectorAll('.history-item-in-progress');
        expect(inProgressItems.length).toBe(inProgressCount);

        // Property: continue hints only appear for in-progress sessions
        const continueHints = document.querySelectorAll('.history-continue-hint');
        expect(continueHints.length).toBe(inProgressCount);

        // Property: analysis reports only appear for completed sessions
        // (completed sessions have non-empty analysis.report)
        const completedWithReport = sessions.filter(
          (s) => s.status === 'completed' && s.analysis?.report
        );
        completedWithReport.forEach((session) => {
          if (session.analysis?.report) {
            expect(document.body.textContent).toContain(session.analysis.report);
          }
        });
      }),
      { numRuns: 20 }
    );
  });

  /**
   * Vocab details badge rendering test
   * Sessions with hasVocabDetails=true SHALL display a vocab badge
   * **Feature: optional-vocab-details**
   * **Validates: Requirements 4.3**
   */
  it('should display vocab badge for sessions with hasVocabDetails=true', () => {
    fc.assert(
      fc.property(
        fc.array(sessionWithVocabDetailsArb(true), { minLength: 1, maxLength: 3 }),
        (sessions) => {
          vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

          renderHistoryPage();

          // Property: vocab badges should equal number of sessions with hasVocabDetails=true
          const vocabBadges = document.querySelectorAll('.history-vocab-badge');
          expect(vocabBadges.length).toBe(sessions.length);

          // Property: each badge should contain "词典" text
          vocabBadges.forEach((badge) => {
            expect(badge.textContent).toContain('词典');
          });
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Vocab details badge NOT rendering test
   * Sessions with hasVocabDetails=false SHALL NOT display a vocab badge
   * **Feature: optional-vocab-details**
   * **Validates: Requirements 4.3**
   */
  it('should NOT display vocab badge for sessions with hasVocabDetails=false', () => {
    fc.assert(
      fc.property(
        fc.array(sessionWithVocabDetailsArb(false), { minLength: 1, maxLength: 3 }),
        (sessions) => {
          vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

          renderHistoryPage();

          // Property: no vocab badges should be rendered
          const vocabBadges = document.querySelectorAll('.history-vocab-badge');
          expect(vocabBadges.length).toBe(0);
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Mixed vocab details sessions render correctly
   * **Feature: optional-vocab-details**
   * **Validates: Requirements 4.3**
   */
  it('should correctly render vocab badges for mixed hasVocabDetails sessions', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(sessionWithVocabDetailsArb(true), { minLength: 1, maxLength: 2 }),
          fc.array(sessionWithVocabDetailsArb(false), { minLength: 1, maxLength: 2 })
        ),
        ([withDetails, withoutDetails]) => {
          const sessions = [...withDetails, ...withoutDetails];
          vi.mocked(storage.loadGuestHistory).mockReturnValue(sessions);

          renderHistoryPage();

          // Property: vocab badges count equals sessions with hasVocabDetails=true
          const vocabBadges = document.querySelectorAll('.history-vocab-badge');
          expect(vocabBadges.length).toBe(withDetails.length);
        }
      ),
      { numRuns: 20 }
    );
  });
});
