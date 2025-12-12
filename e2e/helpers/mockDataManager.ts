import mockData from '../test-data/mock-data.json';

export class MockDataManager {
  private static instance: MockDataManager;
  private mockResponses: Map<string, any> = new Map();

  private constructor() {
    this.initializeMockData();
  }

  static getInstance(): MockDataManager {
    if (!MockDataManager.instance) {
      MockDataManager.instance = new MockDataManager();
    }
    return MockDataManager.instance;
  }

  private initializeMockData(): void {
    // 初始化所有Mock响应
    this.mockResponses.set('vlm-success', mockData.vlm.success);
    this.mockResponses.set('vlm-empty', mockData.vlm.empty);
    this.mockResponses.set('vlm-error', mockData.vlm.error);
    this.mockResponses.set('generation-session', mockData.generation.session);
    this.mockResponses.set('generation-pending', mockData.generation.pending);
    this.mockResponses.set('vocabulary-details', mockData.generation.vocabularyDetails);
    this.mockResponses.set('analysis-success', mockData.analysis.success);
    this.mockResponses.set('auth-register', mockData.auth.register);
    this.mockResponses.set('auth-login', mockData.auth.login);
    this.mockResponses.set('auth-profile', mockData.auth.profile);
    this.mockResponses.set('history-sessions', mockData.history.sessions);
    this.mockResponses.set('history-stats', mockData.history.stats);
  }

  /**
   * 获取Mock响应数据
   */
  getMockData(key: string): any {
    return this.mockResponses.get(key);
  }

  /**
   * 设置自定义Mock响应
   */
  setMockData(key: string, data: any): void {
    this.mockResponses.set(key, data);
  }

  /**
   * 获取VLM成功响应
   */
  getVLMSuccessResponse(words?: string[]): any {
    if (words) {
      return { words };
    }
    return this.mockResponses.get('vlm-success');
  }

  /**
   * 获取VLM空响应
   */
  getVLMEmptyResponse(): any {
    return this.mockResponses.get('vlm-empty');
  }

  /**
   * 获取生成会话响应
   */
  getGenerationSessionResponse(status: 'completed' | 'pending' = 'completed'): any {
    if (status === 'pending') {
      return this.mockResponses.get('generation-pending');
    }
    return this.mockResponses.get('generation-session');
  }

  /**
   * 获取分析报告响应
   */
  getAnalysisResponse(score?: number): any {
    const response = JSON.parse(JSON.stringify(this.mockResponses.get('analysis-success')));
    if (score !== undefined) {
      response.score = score;
      response.correctAnswers = Math.floor(score * response.totalQuestions / 100);
      response.wrongAnswers = response.totalQuestions - response.correctAnswers;
    }
    return response;
  }

  /**
   * 获取认证响应
   */
  getAuthResponse(type: 'register' | 'login', email?: string): any {
    const response = JSON.parse(JSON.stringify(this.mockResponses.get(`auth-${type}`)));
    if (email) {
      response.user.email = email;
    }
    return response;
  }

  /**
   * 获取历史会话响应
   */
  getHistorySessionsResponse(): any {
    return this.mockResponses.get('history-sessions');
  }

  /**
   * 获取学习统计响应
   */
  getHistoryStatsResponse(): any {
    return this.mockResponses.get('history-stats');
  }

  /**
   * 获取词汇详情响应
   */
  getVocabularyDetails(): any {
    return this.mockResponses.get('vocabulary-details');
  }

  /**
   * 生成随机词汇列表
   */
  generateRandomWords(count: number = 5): string[] {
    const allWords = [
      'apple', 'banana', 'orange', 'grape', 'watermelon', 'strawberry', 'pineapple', 'mango',
      'computer', 'keyboard', 'mouse', 'monitor', 'laptop', 'tablet', 'phone', 'camera',
      'happy', 'sad', 'angry', 'excited', 'nervous', 'confident', 'surprised', 'calm',
      'running', 'jumping', 'swimming', 'walking', 'sitting', 'standing', 'sleeping', 'eating'
    ];
    
    const shuffled = allWords.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }

  /**
   * 生成测试题目
   */
  generateTestQuestions(words: string[], difficulty: string = 'beginner'): any {
    const questions = {
      questions_type_1: [] as any[],
      questions_type_2: [] as any[],
      questions_type_3: [] as any[]
    };

    words.forEach((word, index) => {
      // 选择题
      questions.questions_type_1.push({
        id: `q-choice-${index}`,
        word,
        prompt: `What is "${word}"?`,
        choices: [
          { id: 'a', text: `Definition of ${word}` },
          { id: 'b', text: `Wrong option 1` },
          { id: 'c', text: `Wrong option 2` },
          { id: 'd', text: `Wrong option 3` }
        ],
        correctChoiceId: 'a',
        explanation: `This is the correct explanation for ${word}`,
        type: 'questions_type_1'
      });

      // 填空题（此处同时生成多项选择以和前端 Type2 渲染一致）
      questions.questions_type_2.push({
        id: `q-fill-${index}`,
        word,
        prompt: `Complete the sentence: _____ is a word.`,
        choices: [
          { id: 'a', text: `${word}` },
          { id: 'b', text: `not-${word}1` },
          { id: 'c', text: `not-${word}2` },
          { id: 'd', text: `not-${word}3` },
        ],
        correctChoiceId: 'a',
        hint: `Hint for ${word}`,
        explanation: `The answer is ${word}`,
        type: 'questions_type_2'
      });

      // 判断题（作为填空/布尔题，由于前端重用填空机制返回 string 判断）
      questions.questions_type_3.push({
        id: `q-true-${index}`,
        word,
        statement: `"${word}" is a valid English word.`,
        correctAnswer: 'True',
        explanation: `${word} is indeed a valid English word`,
        type: 'questions_type_3'
      });
    });

    return {
      id: `test-session-${Date.now()}`,
      sessionId: `test-session-${Date.now()}`,
      status: 'completed',
      metadata: {
        totalQuestions: words.length * 3,
        words,
        difficulty,
        generatedAt: new Date().toISOString(),
        estimatedTotalQuestions: words.length * 3
      },
      perType: words.length,
      sections: {
        questions_type_1: {
          status: 'ready',
          questions: questions.questions_type_1
        },
        questions_type_2: {
          status: 'ready',
          questions: questions.questions_type_2
        },
        questions_type_3: {
          status: 'ready',
          questions: questions.questions_type_3
        }
      }
    };
  }
}

export const mockDataManager = MockDataManager.getInstance();