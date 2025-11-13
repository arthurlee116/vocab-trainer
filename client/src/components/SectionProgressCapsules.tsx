import type { QuestionType, SectionStatus } from '../types';

export interface SectionCapsuleData {
  type: QuestionType;
  label: string;
  status: SectionStatus;
  count: number;
  error?: string;
  canRetry?: boolean;
}

interface SectionProgressCapsulesProps {
  sections: SectionCapsuleData[];
  onRetry?: (type: QuestionType) => void;
  retryingSection?: QuestionType | null;
}

const getStatusText = (status: SectionStatus, count: number, error?: string) => {
  if (status === 'error') {
    return error ?? '生成失败';
  }
  switch (status) {
    case 'ready':
      return `${count} 题已就绪`;
    case 'generating':
      return '生成中...';
    case 'pending':
      return '等待上一大题';
    default:
      return '';
  }
};

const SectionProgressCapsules = ({ sections, onRetry, retryingSection }: SectionProgressCapsulesProps) => (
  <div className="section-capsule-row">
    {sections.map((section) => {
      const statusText = getStatusText(section.status, section.count, section.error);
      const showRetry =
        onRetry && section.canRetry && section.status === 'error';
      return (
        <div key={section.type} className={`section-status section-${section.status} section-capsule`}>
          <div>
            <strong className="capsule-title">{section.label}</strong>
            <p className="section-status-text capsule-status">{statusText}</p>
          </div>
          {showRetry && (
            <button
              type="button"
              className="secondary capsule-retry"
              onClick={() => onRetry(section.type)}
              disabled={retryingSection === section.type}
            >
              {retryingSection === section.type ? '重试中...' : '重新生成'}
            </button>
          )}
        </div>
      );
    })}
  </div>
);

export default SectionProgressCapsules;
