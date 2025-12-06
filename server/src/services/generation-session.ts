import { randomUUID } from 'crypto';
import { DifficultyLevel, QuestionType, SuperJson, SuperQuestion } from '../types';
import { assignWordsToTypes, generateQuestionsForType, TypeWordMap } from './superGenerator';
import { logger } from '../utils/logger';
import { HttpError } from '../utils/httpError';

type SectionStatus = 'pending' | 'generating' | 'ready' | 'error';

interface SectionState {
  status: SectionStatus;
  questions: SuperQuestion[];
  error?: string | undefined;
  updatedAt?: number | undefined;
  version: number;
}

interface GenerationSession {
  id: string;
  normalizedWords: string[];
  difficulty: DifficultyLevel;
  /** @deprecated 使用 typeWordMap 替代，保留用于向后兼容 */
  perType: number;
  /** 按题型分配的单词映射 */
  typeWordMap: TypeWordMap;
  createdAt: number;
  metadata: {
    generatedAt: string;
    words: string[];
    difficulty: DifficultyLevel;
    totalQuestionsEstimate: number;
    totalQuestions: number;
  };
  sections: Record<QuestionType, SectionState>;
}

const SESSION_TTL_MS = 1000 * 60 * 30; // 30 minutes
const sessions = new Map<string, GenerationSession>();

const initialSectionState = (): SectionState => ({
  status: 'pending',
  questions: [],
  version: 0,
});

const normalizeWords = (words: string[]): string[] =>
  Array.from(new Set(words.map((w) => w.trim().toLowerCase()))).filter(Boolean);

const questionTypes: QuestionType[] = ['questions_type_1', 'questions_type_2', 'questions_type_3'];

const updateTotalQuestions = (session: GenerationSession) => {
  session.metadata.totalQuestions = questionTypes.reduce(
    (sum, type) => sum + session.sections[type].questions.length,
    0,
  );
};

const scheduleCleanup = (sessionId: string) => {
  const timer = setTimeout(() => {
    sessions.delete(sessionId);
  }, SESSION_TTL_MS);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }
};

const serializeSession = (session: GenerationSession) => {
  const metadata = session.metadata;
  return {
    sessionId: session.id,
    metadata: {
      totalQuestions: metadata.totalQuestions || metadata.totalQuestionsEstimate,
      estimatedTotalQuestions: metadata.totalQuestionsEstimate,
      generatedAt: metadata.generatedAt,
      difficulty: metadata.difficulty,
      words: metadata.words,
    },
    perType: session.perType,
    sections: questionTypes.reduce(
      (acc, type) => ({
        ...acc,
        [type]: {
          status: session.sections[type].status,
          questions: session.sections[type].questions,
          error: session.sections[type].error,
          updatedAt: session.sections[type].updatedAt,
        },
      }),
      {} as Record<QuestionType, { status: SectionStatus; questions: SuperQuestion[]; error?: string; updatedAt?: number }>,
    ),
  };
};

const ensureSession = (sessionId: string): GenerationSession => {
  const session = sessions.get(sessionId);
  if (!session) {
    throw new HttpError(404, 'Generation session not found');
  }
  return session;
};

const triggerSectionGeneration = async (
  sessionId: string,
  questionType: QuestionType,
  { awaitResult = false }: { awaitResult?: boolean } = {},
) => {
  const session = ensureSession(sessionId);
  const section = session.sections[questionType];
  section.status = 'generating';
  section.error = undefined;
  section.version += 1;
  const currentVersion = section.version;

  // 使用分配给该题型的单词列表
  const wordsForType = session.typeWordMap[questionType];

  const exec = generateQuestionsForType({
    questionType,
    words: wordsForType,
    difficulty: session.difficulty,
  })
    .then((questions) => {
      const latest = sessions.get(sessionId);
      if (!latest) {
        return;
      }
      const target = latest.sections[questionType];
      if (target.version !== currentVersion) {
        return;
      }
      target.questions = questions;
      target.status = 'ready';
      target.updatedAt = Date.now();
      updateTotalQuestions(latest);

      if (questionType === 'questions_type_2') {
        const third = latest.sections.questions_type_3;
        if (third.status !== 'ready') {
          void triggerSectionGeneration(sessionId, 'questions_type_3');
        }
      }
    })
    .catch((error) => {
      const latest = sessions.get(sessionId);
      if (!latest) {
        return;
      }
      const target = latest.sections[questionType];
      if (target.version !== currentVersion) {
        return;
      }
      target.status = 'error';
      target.error = error instanceof Error ? error.message : String(error);
      target.updatedAt = Date.now();
      logger.error(`GenerationSession: ${questionType} failed`, {
        sessionId,
        error: target.error,
      });
    });

  if (awaitResult) {
    await exec;
  } else {
    void exec;
  }
};

export const startGenerationSession = async (params: {
  words: string[];
  difficulty: DifficultyLevel;
  questionCountPerType?: number;
}) => {
  const normalizedWords = normalizeWords(params.words);
  if (!normalizedWords.length) {
    throw new HttpError(400, 'Word list cannot be empty');
  }

  // 使用智能单词分配算法：每个单词随机分配到 2 种题型
  // 移除了 Math.min(20, normalizedWords.length) 的硬编码限制
  const typeWordMap = assignWordsToTypes(normalizedWords);

  // 计算每种题型的题目数量（等于分配给该题型的单词数）
  const perTypeEstimates = {
    questions_type_1: typeWordMap.questions_type_1.length,
    questions_type_2: typeWordMap.questions_type_2.length,
    questions_type_3: typeWordMap.questions_type_3.length,
  };

  // 总题目数 = 单词数 × 2（每个单词分配到 2 种题型）
  const totalQuestionsEstimate = normalizedWords.length * 2;

  // 保留 perType 用于向后兼容（取平均值）
  const perType = params.questionCountPerType ?? Math.ceil(totalQuestionsEstimate / questionTypes.length);

  if (normalizedWords.length < 3) {
    throw new HttpError(400, 'Word list must contain at least 3 words');
  }

  logger.info(`GenerationSession: Word assignment completed`, {
    totalWords: normalizedWords.length,
    type1Words: perTypeEstimates.questions_type_1,
    type2Words: perTypeEstimates.questions_type_2,
    type3Words: perTypeEstimates.questions_type_3,
    totalQuestionsEstimate,
  });

  const sessionId = randomUUID();
  const session: GenerationSession = {
    id: sessionId,
    normalizedWords,
    difficulty: params.difficulty,
    perType,
    typeWordMap,
    createdAt: Date.now(),
    metadata: {
      generatedAt: new Date().toISOString(),
      words: normalizedWords,
      difficulty: params.difficulty,
      totalQuestionsEstimate,
      totalQuestions: 0,
    },
    sections: {
      questions_type_1: initialSectionState(),
      questions_type_2: initialSectionState(),
      questions_type_3: initialSectionState(),
    },
  };

  sessions.set(sessionId, session);
  scheduleCleanup(sessionId);

  await triggerSectionGeneration(sessionId, 'questions_type_1', { awaitResult: true });
  void triggerSectionGeneration(sessionId, 'questions_type_2');

  return serializeSession(session);
};

export const getGenerationSessionSnapshot = (sessionId: string) => {
  const session = ensureSession(sessionId);
  return serializeSession(session);
};

export const retryGenerationSection = async (sessionId: string, questionType: QuestionType) => {
  const session = ensureSession(sessionId);

  if (questionType === 'questions_type_3') {
    const second = session.sections.questions_type_2;
    if (second.status !== 'ready') {
      throw new HttpError(400, '第二大题尚未生成，无法生成第三大题');
    }
  }

  if (questionType === 'questions_type_2') {
    const third = session.sections.questions_type_3;
    if (third.status !== 'ready') {
      third.status = 'pending';
      third.questions = [];
      third.error = undefined;
      third.updatedAt = undefined;
    }
  }

  await triggerSectionGeneration(sessionId, questionType);
  return serializeSession(session);
};

export const consumeFullSuperJson = (sessionId: string): SuperJson => {
  const session = ensureSession(sessionId);
  const missingType = questionTypes.find((type) => session.sections[type].status !== 'ready');
  if (missingType) {
    throw new HttpError(409, `${missingType} 仍在生成中，无法导出完整题库`);
  }

  return {
    metadata: {
      totalQuestions: session.metadata.totalQuestions,
      words: session.metadata.words,
      difficulty: session.metadata.difficulty,
      generatedAt: session.metadata.generatedAt,
    },
    questions_type_1: session.sections.questions_type_1.questions,
    questions_type_2: session.sections.questions_type_2.questions,
    questions_type_3: session.sections.questions_type_3.questions,
  };
};
