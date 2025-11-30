import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import SectionProgressCapsules from '../components/SectionProgressCapsules';

describe('SectionProgressCapsules', () => {
  it('根据不同状态展示描述', () => {
    render(
      <SectionProgressCapsules
        sections={[
          {
            type: 'questions_type_1',
            label: '第一题型',
            status: 'generating',
            count: 3,
          },
          {
            type: 'questions_type_2',
            label: '第二题型',
            status: 'pending',
            count: 0,
          },
        ]}
      />,
    );

    expect(screen.getByText('生成中...')).toBeInTheDocument();
    expect(screen.getByText('等待上一大题')).toBeInTheDocument();
  });

  it('展示每个模块的状态与重试按钮', async () => {
    const handleRetry = vi.fn();
    render(
      <SectionProgressCapsules
        sections={[
          {
            type: 'questions_type_1',
            label: '第一题型',
            status: 'ready',
            count: 5,
          },
          {
            type: 'questions_type_2',
            label: '第二题型',
            status: 'error',
            count: 0,
            error: '生成失败',
            canRetry: true,
          },
        ]}
        onRetry={handleRetry}
        retryingSection={null}
      />,
    );

    expect(screen.getByText('第一题型')).toBeInTheDocument();
    expect(screen.getByText('5 题已就绪')).toBeInTheDocument();
    expect(screen.getByText('生成失败')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '重新生成' }));
    expect(handleRetry).toHaveBeenCalledWith('questions_type_2');
  });

  it('error 状态缺省消息会使用兜底文案', () => {
    render(
      <SectionProgressCapsules
        sections={[
          {
            type: 'questions_type_1',
            label: '第一题型',
            status: 'error',
            count: 0,
          },
        ]}
      />,
    );

    expect(screen.getByText('生成失败')).toBeInTheDocument();
  });
});
