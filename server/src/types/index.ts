export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export type QuestionType = 'questions_type_1' | 'questions_type_2' | 'questions_type_3';

export interface Choice {
  id: string;
  text: string;
}

export interface SuperQuestion {
  id: string;
  word: string;
  prompt: string;
  choices?: Choice[];
  correctChoiceId?: string;
  correctAnswer?: string;
  explanation: string;
  type: QuestionType;
  sentence?: string;
  translation?: string;
  hint?: string;
}

export interface SuperJson {
  metadata: {
    totalQuestions: number;
    words: string[];
    difficulty: DifficultyLevel;
    generatedAt: string;
  };
  questions_type_1: SuperQuestion[];
  questions_type_2: SuperQuestion[];
  questions_type_3: SuperQuestion[];
}

export interface AnswerRecord {
  questionId: string;
  choiceId?: string;
  userInput?: string;
  correct: boolean;
  elapsedMs: number;
}

export type SessionStatus = 'in_progress' | 'completed';

export interface SessionRecord {
  id: string;
  userId?: string | null;
  mode: 'guest' | 'authenticated';
  difficulty: DifficultyLevel;
  words: string[];
  superJson: SuperJson;
  answers: AnswerRecord[];
  score: number;
  analysis: AnalysisSummary;
  createdAt: string;
  // Session resume fields (Requirements 2.1, 2.3)
  status: SessionStatus;
  currentQuestionIndex: number;
  updatedAt: string;
}

export interface InProgressSessionSummary {
  id: string;
  difficulty: DifficultyLevel;
  wordCount: number;
  answeredCount: number;
  totalQuestions: number;
  createdAt: string;
  updatedAt: string;
}

export interface AnalysisSummary {
  report: string;
  recommendations: string[];
}

export interface VocabularyExample {
  en: string;
  zh: string;
}

export interface VocabularyDetail {
  word: string;
  partsOfSpeech: string[];
  definitions: string[];
  examples: VocabularyExample[];
}

export interface WeeklyActivity {
  date: string;
  count: number;
}

export interface StatsResponse {
  totalWordsLearned: number;
  totalSessionsCompleted: number;
  weeklyActivity: WeeklyActivity[];
}
