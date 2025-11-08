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
  choices: Choice[];
  correctChoiceId: string;
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
  choiceId: string;
  correct: boolean;
  elapsedMs: number;
}

export interface AnalysisSummary {
  report: string;
  recommendations: string[];
}

export interface SessionSnapshot {
  id: string;
  mode: 'guest' | 'authenticated';
  userId?: string;
  difficulty: DifficultyLevel;
  words: string[];
  score: number;
  analysis: AnalysisSummary;
  superJson: SuperJson;
  answers: AnswerRecord[];
  createdAt: string;
}

export interface ImageFile {
  file: File;
  preview: string;
  id: string;
}

export interface ImageValidationResult {
  valid: ImageFile[];
  errors: string[];
}
