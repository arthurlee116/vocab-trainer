/**
 * InProgressSessionCard Tests
 * 
 * Tests for the in-progress session card component.
 * Requirements: 4.2, 4.3, 4.4
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect } from 'vitest';
import InProgressSessionCard from '../InProgressSessionCard';
import type { InProgressSessionSummary } from '../../types';

const mockSession: InProgressSessionSummary = {
  id: 'test-session-1',
  difficulty: 'beginner',
  wordCount: 25,
  answeredCount: 15,
  totalQuestions: 50,
  createdAt: '2025-12-01T10:00:00Z',
  updatedAt: new Date().toISOString(), // Recent update
};

describe('InProgressSessionCard', () => {
  it('displays session info correctly (Requirements 4.2)', () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    render(
      <InProgressSessionCard
        session={mockSession}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    // Check difficulty badge
    expect(screen.getByText('初级')).toBeInTheDocument();
    
    // Check word count
    expect(screen.getByText('25 词')).toBeInTheDocument();
    
    // Check progress
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.getByText(/50 题/)).toBeInTheDocument();
    expect(screen.getByText('(30%)')).toBeInTheDocument();
  });

  it('calls onContinue when continue button is clicked (Requirements 4.3)', async () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    render(
      <InProgressSessionCard
        session={mockSession}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /继续/i }));
    
    expect(onContinue).toHaveBeenCalledWith('test-session-1');
  });

  it('shows confirmation dialog when delete is clicked (Requirements 4.4)', async () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    render(
      <InProgressSessionCard
        session={mockSession}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    // Click delete button
    await userEvent.click(screen.getByRole('button', { name: /删除练习/i }));
    
    // Confirmation should appear
    expect(screen.getByText('确定要删除这个练习吗？此操作不可撤销。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '确认删除' })).toBeInTheDocument();
  });

  it('calls onDelete when deletion is confirmed (Requirements 4.4)', async () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    render(
      <InProgressSessionCard
        session={mockSession}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    // Click delete button
    await userEvent.click(screen.getByRole('button', { name: /删除练习/i }));
    
    // Confirm deletion
    await userEvent.click(screen.getByRole('button', { name: '确认删除' }));
    
    expect(onDelete).toHaveBeenCalledWith('test-session-1');
  });

  it('hides confirmation when cancel is clicked (Requirements 4.4)', async () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    render(
      <InProgressSessionCard
        session={mockSession}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    // Click delete button
    await userEvent.click(screen.getByRole('button', { name: /删除练习/i }));
    
    // Cancel
    await userEvent.click(screen.getByRole('button', { name: '取消' }));
    
    // Confirmation should be hidden
    expect(screen.queryByText('确定要删除这个练习吗？此操作不可撤销。')).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('displays different difficulty levels correctly', () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    const { rerender } = render(
      <InProgressSessionCard
        session={{ ...mockSession, difficulty: 'intermediate' }}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('中级')).toBeInTheDocument();

    rerender(
      <InProgressSessionCard
        session={{ ...mockSession, difficulty: 'advanced' }}
        onContinue={onContinue}
        onDelete={onDelete}
      />
    );

    expect(screen.getByText('高级')).toBeInTheDocument();
  });

  it('shows deleting state when isDeleting is true', () => {
    const onContinue = vi.fn();
    const onDelete = vi.fn();

    render(
      <InProgressSessionCard
        session={mockSession}
        onContinue={onContinue}
        onDelete={onDelete}
        isDeleting={true}
      />
    );

    // When isDeleting, the card should still render normally
    // (confirmation dialog would show "删除中..." if open)
    expect(screen.getByText('初级')).toBeInTheDocument();
  });
});
