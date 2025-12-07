/**
 * Property-based tests for ConfirmWordsPage Toggle component
 * **Feature: optional-vocab-details, Property 1: Toggle state inversion**
 * **Validates: Requirements 1.3**
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConfirmWordsPage from '../ConfirmWordsPage';
import { usePracticeStore } from '../../store/usePracticeStore';

// Mock the API module
vi.mock('../../lib/api', () => ({
  fetchVocabularyDetails: vi.fn(),
  startGenerationSession: vi.fn(),
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('ConfirmWordsPage Toggle - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store with some words so we can see the difficulty panel
    usePracticeStore.setState({
      words: ['apple', 'banana', 'cherry'],
      vocabDetails: undefined,
      detailsError: undefined,
    });
  });

  /**
   * Property 1: Toggle state inversion
   * *For any* current toggle state (on or off), clicking the toggle should result in the opposite state.
   * **Validates: Requirements 1.3**
   */
  it('should invert toggle state on each click', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of click counts (1 to 10 clicks)
        fc.integer({ min: 1, max: 10 }),
        (clickCount) => {
          // Render the component fresh for each property test
          const { unmount } = render(
            <MemoryRouter>
              <ConfirmWordsPage />
            </MemoryRouter>
          );

          // Click "确认，开始练习" to show difficulty panel with toggle
          const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
          fireEvent.click(confirmButton);

          // Find the toggle switch
          const toggleSwitch = screen.getByRole('switch');
          
          // Initial state should be off (not active)
          expect(toggleSwitch.classList.contains('active')).toBe(false);
          expect(toggleSwitch.getAttribute('aria-checked')).toBe('false');

          // Track expected state: starts as false (off)
          let expectedState = false;

          // Click the toggle `clickCount` times and verify state inverts each time
          for (let i = 0; i < clickCount; i++) {
            fireEvent.click(toggleSwitch);
            expectedState = !expectedState;
            
            // Property: after each click, state should be inverted
            expect(toggleSwitch.classList.contains('active')).toBe(expectedState);
            expect(toggleSwitch.getAttribute('aria-checked')).toBe(String(expectedState));
          }

          // Cleanup
          unmount();
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * Property 1 (keyboard variant): Toggle state inversion via keyboard
   * *For any* current toggle state, pressing Enter or Space should result in the opposite state.
   * **Validates: Requirements 1.3**
   */
  it('should invert toggle state on keyboard activation (Enter/Space)', () => {
    fc.assert(
      fc.property(
        // Generate a sequence of key presses
        fc.array(fc.constantFrom('Enter', ' '), { minLength: 1, maxLength: 10 }),
        (keySequence) => {
          const { unmount } = render(
            <MemoryRouter>
              <ConfirmWordsPage />
            </MemoryRouter>
          );

          // Show difficulty panel
          const confirmButton = screen.getByRole('button', { name: /确认，开始练习/i });
          fireEvent.click(confirmButton);

          const toggleSwitch = screen.getByRole('switch');
          
          // Initial state should be off
          expect(toggleSwitch.getAttribute('aria-checked')).toBe('false');

          let expectedState = false;

          // Press keys and verify state inverts each time
          for (const key of keySequence) {
            fireEvent.keyDown(toggleSwitch, { key });
            expectedState = !expectedState;
            
            expect(toggleSwitch.getAttribute('aria-checked')).toBe(String(expectedState));
          }

          unmount();
        }
      ),
      { numRuns: 15 }
    );
  });
});
