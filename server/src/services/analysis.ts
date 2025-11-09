import { AnswerRecord, DifficultyLevel, SuperJson, AnalysisSummary } from '../types';
import { openRouterChat } from './openrouter';
import { logger } from '../utils/logger';

export const buildAnalysis = async (params: {
  difficulty: DifficultyLevel;
  words: string[];
  answers: AnswerRecord[];
  superJson: SuperJson;
  score: number;
}): Promise<AnalysisSummary> => {
  const startTime = Date.now();

  const schema = {
    name: 'analysis_report',
    strict: true,
    schema: {
      type: 'object',
      properties: {
        report: {
          type: 'string',
          description: '约 100 字的中文分析，包含总体评价与鼓励',
        },
        recommendations: {
          type: 'array',
          minItems: 2,
          maxItems: 4,
          description: '中文建议，面向学习动作',
          items: {
            type: 'string',
          },
        },
      },
      required: ['report', 'recommendations'],
      additionalProperties: false,
    },
  };

  const { difficulty, words, answers, score } = params;
  const wrongIds = answers.filter((ans) => !ans.correct).map((ans) => ans.questionId);

  logger.info(`Analysis: Building analysis report for ${answers.length} answers (score: ${score}%, ${wrongIds.length} wrong)`, {
    difficulty,
    wordsCount: words.length
  });

  const messages = [
    {
      role: 'system' as const,
      content:
        '你是英语学习教练。请阅读答题记录，输出简洁、鼓励式的中文反馈，并提供 2-4 条下一步学习建议。',
    },
    {
      role: 'user' as const,
      content: JSON.stringify(
        {
          difficulty,
          words,
          score,
          wrongQuestionIds: wrongIds,
          totalQuestions: answers.length,
        },
        null,
        2,
      ),
    },
  ];

  try {
    const result = await openRouterChat<AnalysisSummary>({
      model: 'openrouter/polaris-alpha',
      messages,
      response_format: {
        type: 'json_schema',
        json_schema: schema,
      },
    });

    const responseTime = Date.now() - startTime;

    logger.info(`Analysis: Successfully generated analysis report in ${responseTime}ms`, {
      score,
      wrongAnswers: wrongIds.length,
      recommendationsCount: result.recommendations?.length || 0
    });

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    logger.error(`Analysis: Failed to build analysis report after ${responseTime}ms`, {
      error: error instanceof Error ? error.message : error,
      score,
      wrongAnswers: wrongIds.length
    });
    throw error;
  }
};
