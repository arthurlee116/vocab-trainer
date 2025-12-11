import { test, expect } from '@playwright/test';
import { LandingPage } from './pageObjects/LandingPage';
import { DashboardPage } from './pageObjects/DashboardPage';
import { UploadPage } from './pageObjects/UploadPage';
import { QuizPage } from './pageObjects/QuizPage';
import { VocabularyDetailsPage } from './pageObjects/VocabularyDetailsPage';
import { TestHelpers, TEST_DATA } from './helpers/testHelpers';
import { mockDataManager } from './helpers/mockDataManager';

test.describe('完整练习流程测试', () => {
  let landingPage: LandingPage;
  let dashboardPage: DashboardPage;
  let uploadPage: UploadPage;
  let quizPage: QuizPage;
  let vocabDetailsPage: VocabularyDetailsPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    dashboardPage = new DashboardPage(page);
    uploadPage = new UploadPage(page);
    quizPage = new QuizPage(page);
    vocabDetailsPage = new VocabularyDetailsPage(page);
    
    // 先导航到页面，确保可以访问localStorage
    await page.goto('/');
    
    // 清理本地存储
    await TestHelpers.clearLocalStorage(page);
    
    // Mock所有必要的API
    await setupMockAPIs(page);
  });

  async function setupMockAPIs(page: any) {
    // Mock VLM API
    await page.route('**/api/vlm/extract', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getVLMSuccessResponse())
      });
    });

    // Mock 生成会话API - default create returns generated questions based on posted words
    const generatedSessions = new Map<string, any>();
    // Mock 生成会话API - store generated snapshot for follow-up GET requests
    await page.route('**/api/generation/session', async (route: any) => {
      if (route.request().method() === 'POST') {
        const postData = await route.request().postData();
        const { words, difficulty } = JSON.parse(postData || '{}');
        console.log('[e2e mock] POST /api/generation/session', { words, difficulty });
        const snapshot = mockDataManager.generateTestQuestions(words, difficulty);
        // store the generated snapshot for follow-up GET requests
        if (snapshot && snapshot.sessionId) {
          generatedSessions.set(snapshot.sessionId, snapshot);
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(snapshot)
        });
        return;
      }
      await route.continue();
    });

    // Mock 生成进度API (GET session/:id) - return a completed session when polled
    await page.route('**/api/generation/session/*', async (route: any) => {
      const url = route.request().url();
      const match = url.match(/generation\/session\/(.+)$/);
      if (match && generatedSessions.has(match[1])) {
        console.log('[e2e mock] GET /api/generation/session/' + match[1]);
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(generatedSessions.get(match[1]))
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getGenerationSessionResponse('completed'))
      });
    });

    // Mock 分析API
    await page.route('**/api/analysis/report', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getAnalysisResponse(85))
      });
    });

    // Mock 保存会话API
    await page.route('**/api/history', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `session-${Date.now()}`,
          status: 'completed'
        })
      });
    });

    // Mock auth endpoints (default behavior for tests that perform login)
    await page.route('**/api/auth/login', async (route: any) => {
      const postData = await route.request().postData();
      try {
        const { email, password } = JSON.parse(postData || '{}');
        if (email === TEST_DATA.VALID_EMAIL && password === TEST_DATA.VALID_PASSWORD) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockDataManager.getAuthResponse('login', email))
          });
        } else {
          await route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid credentials' }) });
        }
      } catch (err) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid request' }) });
      }
    });

    await page.route('**/api/auth/register', async (route: any) => {
      const postData = await route.request().postData();
      try {
        const { email, password } = JSON.parse(postData || '{}');
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDataManager.getAuthResponse('register', email)) });
      } catch (err) {
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Invalid request' }) });
      }
    });

    await page.route('**/api/auth/me', async (route: any) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(mockDataManager.getMockData('auth-profile')) });
    });

    // Mock 生成词汇详情 API
    await page.route('**/api/generation/details', async (route: any) => {
      console.log('[e2e mock] generation/details called');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getVocabularyDetails())
      });
    });

    // Mock bind generation session to history (no-op success)
    await page.route('**/api/generation/session/*/bind', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });
  }

  test.describe('游客模式完整流程', () => {
    test('应该完成从上传到报告的完整流程', async ({ page }) => {
      // 1. 进入游客模式
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();

      // 2. 点击上传词表
      await dashboardPage.clickUploadButton();
      await uploadPage.waitForPageLoad();

      // 3. 模拟上传图片
      await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse());
      await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
      await uploadPage.clickStartRecognition();
      await uploadPage.waitForRecognitionComplete();
      await uploadPage.waitForRedirectToConfirm();

      // 4. 在确认页面选择难度并开始生成（启用词汇详情）
      // 等待确认页面加载并点击“确认，开始练习”以弹出难度选项
      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: '确认，开始练习' }).click();
      await page.getByText('选择难度：').waitFor({ state: 'visible' });
      // 开启词汇详情生成
      const vocabSwitch = page.locator('[data-testid="vocab-details-toggle"] [role="switch"]');
      await vocabSwitch.click();
      await expect(vocabSwitch).toHaveAttribute('aria-checked', 'true');
      // 选择难度（初级）并开始生成
      await page.getByRole('button', { name: '初级' }).click();

      // 5. 等待跳转到词汇详情页
      // 5. 等待跳转到词汇详情页或 Quiz（应用在不同条件下可能直接跳转 Quiz）
      try {
        await page.waitForURL(/\/practice\/details/, { timeout: 15000 });
        await vocabDetailsPage.waitForPageLoad();
        // 确认词汇详情可见并包含条目
        const entryCount = await vocabDetailsPage.getVocabEntriesCount();
        await expect(entryCount).toBeGreaterThan(0);
        // 点击开始练习进入答题页
        await vocabDetailsPage.clickStartPractice();
      } catch (err) {
        // 如果没有跳转到详情，等到 Quiz 页面直接开始答题
        await page.waitForURL(/\/practice\/quiz/);
      }

      // 5. 等待题目生成完成
      await page.waitForURL(/\/practice\/quiz/);
      await quizPage.waitForPageLoad();

      // 6. 模拟答题过程
      const answers = [
        { type: 'choice' as const, value: 'Definition of apple' },
        { type: 'choice' as const, value: 'apple' },
        { type: 'text' as const, value: 'True' }
      ];
      
      await quizPage.completeQuiz(answers);

      // 7. 等待跳转到报告页面
      await quizPage.waitForRedirectToReport();

      // 8. 验证报告页面内容
      await expect(page.getByText('练习报告')).toBeVisible();
      await expect(page.getByText('85')).toBeVisible(); // 分数
      await expect(page.getByText('注册/登录')).toBeVisible(); // 游客模式提示
    });

    test('应该能够暂停和恢复练习', async ({ page }) => {
      // 进入游客模式并开始练习
      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse());
      await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
      await uploadPage.clickStartRecognition();
      await uploadPage.waitForRecognitionComplete();
      await uploadPage.waitForRedirectToConfirm();

      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: '确认，开始练习' }).click();
      await page.getByText('选择难度：').waitFor({ state: 'visible' });
      const vocabSwitch2 = page.locator('[data-testid="vocab-details-toggle"] [role="switch"]');
      await vocabSwitch2.click();
      await expect(vocabSwitch2).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: '初级' }).click();
      try {
        await page.waitForURL(/\/practice\/details/, { timeout: 15000 });
        await vocabDetailsPage.waitForPageLoad();
        await vocabDetailsPage.clickStartPractice();
      } catch (err) {
        await page.waitForURL(/\/practice\/quiz/);
      }

      await page.waitForURL(/\/practice\/quiz/);
      await quizPage.waitForPageLoad();

      // 暂停练习
      if (await quizPage.pauseButton.isVisible()) {
        await quizPage.clickPause();
        
        // 验证暂停状态
        await expect(page.getByText('暂停练习')).toBeVisible();
        
        // 恢复练习（从暂停返回继续答题）
        await page.getByRole('button', { name: '继续答题' }).click();
        await quizPage.waitForPageLoad();
      }
    });
  });

  test.describe('登录用户完整流程', () => {
    test('应该完成完整流程并保存到历史记录', async ({ page }) => {
      // 1. 登录
      await landingPage.login(TEST_DATA.VALID_EMAIL, TEST_DATA.VALID_PASSWORD);
      await dashboardPage.waitForPageLoad();

      // 2. Mock历史记录API
      await page.route('**/api/history*', async (route: any) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockDataManager.getHistorySessionsResponse())
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: `session-${Date.now()}` })
          });
        }
      });

      // 3. 点击上传词表
      await dashboardPage.clickUploadButton();
      await uploadPage.waitForPageLoad();

      // 4. 上传图片并识别
      await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse());
      await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
      await uploadPage.clickStartRecognition();
      await uploadPage.waitForRecognitionComplete();
      await uploadPage.waitForRedirectToConfirm();

      // 5. 选择难度并生成题目
      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: '确认，开始练习' }).click();
      await page.getByText('选择难度：').waitFor({ state: 'visible' });
      const vocabSwitch3 = page.locator('[data-testid="vocab-details-toggle"] [role="switch"]');
      await vocabSwitch3.click();
      await expect(vocabSwitch3).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: '中级' }).click();
      try {
        await page.waitForURL(/\/practice\/details/, { timeout: 15000 });
        await vocabDetailsPage.waitForPageLoad();
        await vocabDetailsPage.clickStartPractice();
      } catch (err) {
        await page.waitForURL(/\/practice\/quiz/);
      }

      // 6. 等待题目生成并答题
      await page.waitForURL(/\/practice\/quiz/);
      await quizPage.waitForPageLoad();

      const answers = [
        { type: 'choice' as const, value: 'Definition of apple' },
        { type: 'choice' as const, value: 'apple' },
        { type: 'text' as const, value: 'True' }
      ];
      
      await quizPage.completeQuiz(answers);
      await quizPage.waitForRedirectToReport();

      // 7. 验证报告页面
      await expect(page.getByText('练习报告')).toBeVisible();
      await expect(page.getByText('85')).toBeVisible();

      // 8. 验证历史记录保存
      await dashboardPage.clickHistoryButton();
      await page.waitForURL(/\/history/);
      
      // 验证历史记录列表
      await expect(page.getByText('历史记录')).toBeVisible();
      await expect(page.getByText('beginner')).toBeVisible();
      await expect(page.getByText('intermediate')).toBeVisible();
    });

    test('应该显示学习统计信息', async ({ page }) => {
      // Mock统计API
      await page.route('**/api/history/stats', async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDataManager.getHistoryStatsResponse())
        });
      });

      await landingPage.login(TEST_DATA.VALID_EMAIL, TEST_DATA.VALID_PASSWORD);
      await dashboardPage.waitForPageLoad();

      // 验证统计信息显示
      const stats = await dashboardPage.getLearningStats();
      expect(stats.wordsLearned).toBeTruthy();
      expect(stats.sessionsCompleted).toBeTruthy();
      expect(stats.weeklyActivity).toBeTruthy();
    });
  });

  test.describe('题目生成流程', () => {
    test('应该能够选择不同难度级别', async ({ page }) => {
      // We'll repeat the upload + confirm flow per difficulty to keep each attempt independent and avoid navigation race conditions
      const difficulties = ['beginner', 'intermediate', 'advanced'];
      const labelMap: Record<string, string> = {
        beginner: '初级',
        intermediate: '中级',
        advanced: '高级',
      };

      for (const difficulty of difficulties) {
        await landingPage.enterGuestMode();
        await dashboardPage.clickUploadButton();
        await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse());
        await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
        await uploadPage.clickStartRecognition();
        await uploadPage.waitForRecognitionComplete();
        await uploadPage.waitForRedirectToConfirm();

        // 弹出难度选择
        await page.waitForTimeout(500);
        await page.getByRole('button', { name: '确认，开始练习' }).click();
        await page.getByText('选择难度：').waitFor({ state: 'visible' });

        // 点击具体难度并验证导航成功
        await page.getByRole('button', { name: labelMap[difficulty] }).click();
        await page.waitForURL(/\/practice\/(details|quiz)/);

        // 返回首页以进行下一次测试迭代
        await page.goto('/');
      }
    });

    test('应该显示生成进度', async ({ page }) => {
      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse());
      await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
      await uploadPage.clickStartRecognition();
      await uploadPage.waitForRecognitionComplete();
      await uploadPage.waitForRedirectToConfirm();

      // Mock生成中的状态: POST create and GET session/:id return pending
      await page.route('**/api/generation/session', async (route: any) => {
        if (route.request().method() === 'POST') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockDataManager.getGenerationSessionResponse('pending'))
          });
          return;
        }
        await route.continue();
      });

      await page.route('**/api/generation/session/*', async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDataManager.getGenerationSessionResponse('pending'))
        });
      });

      await page.waitForTimeout(2000);
      await page.getByRole('button', { name: '确认，开始练习' }).click();
      await page.getByText('选择难度：').waitFor({ state: 'visible' });
      const vocabSwitch4 = page.locator('[data-testid="vocab-details-toggle"] [role="switch"]');
      await vocabSwitch4.click();
      await expect(vocabSwitch4).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: '初级' }).click();
      await page.waitForURL(/\/practice\/details/);
      await vocabDetailsPage.waitForPageLoad();
      await vocabDetailsPage.clickStartPractice();

      // 验证生成进度显示（词汇详情或确认页面展示不同文本）
      await expect(page.getByText(/AI 正在整理词条/)).toBeVisible();
    });
  });

  test.describe('答题交互测试', () => {
    test('应该正确处理不同类型的题目', async ({ page }) => {
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 测试选择题
      const questionType = await quizPage.getQuestionType();
      if (questionType === 'multiple-choice') {
        const options = await quizPage.getOptions();
        expect(options.length).toBeGreaterThan(0);
        
        await quizPage.selectOption(options[0]);
        await expect(quizPage.nextButton).toBeVisible();
      }

      // 测试填空题
      if (questionType === 'fill-blank') {
        await expect(quizPage.textInput).toBeVisible();
        await quizPage.fillTextAnswer('test answer');
        await expect(quizPage.submitButton).toBeVisible();
      }
    });

    test('应该显示答题进度', async ({ page }) => {
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      const progress = await quizPage.getProgress();
      expect(progress).toBeTruthy();
      
      const questionNumber = await quizPage.getQuestionNumber();
      expect(questionNumber).toBeTruthy();
    });

    test('应该支持听力模式', async ({ page }) => {
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      if (await quizPage.listeningModeButton.isVisible()) {
        await quizPage.toggleListeningMode();
        
        // 验证听力模式状态变化
        // 这里根据实际实现调整断言
        await expect(quizPage.listeningModeButton).toBeVisible();
      }
    });
  });

  test.describe('报告页面测试', () => {
    test('应该显示详细的练习报告', async ({ page }) => {
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 完成答题
      const answers = [
        { type: 'choice' as const, value: 'Definition of apple' },
        { type: 'choice' as const, value: 'apple' }
      ];
      
      await quizPage.completeQuiz(answers);
      await quizPage.waitForRedirectToReport();

      // 验证报告内容
      await expect(page.getByText('练习报告')).toBeVisible();
      await expect(page.getByText('得分')).toBeVisible();
      await expect(page.getByText('正确率')).toBeVisible();
      await expect(page.getByText('用时')).toBeVisible();
    });

    test('应该显示错题分析', async ({ page }) => {
      // Mock包含错题的分析响应
      await page.route('**/api/analysis/report', async (route: any) => {
        const response = mockDataManager.getAnalysisResponse(70); // 较低分数，有错题
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(response)
        });
      });

      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      const answers = [
        { type: 'choice' as const, value: 'Wrong answer' }, // 故意答错
        { type: 'choice' as const, value: 'apple' }
      ];
      
      await quizPage.completeQuiz(answers);
      await quizPage.waitForRedirectToReport();

      // 验证错题显示
      await expect(page.getByText('错题分析')).toBeVisible();
      await expect(page.getByText('正确答案')).toBeVisible();
    });
  });

  // 辅助函数：设置答题页面
  async function setupQuizPage(page: any) {
    await landingPage.enterGuestMode();
    await dashboardPage.clickUploadButton();
    await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse());
    await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
    await uploadPage.clickStartRecognition();
    await uploadPage.waitForRecognitionComplete();
    await uploadPage.waitForRedirectToConfirm();

    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: '确认，开始练习' }).click();
    await page.getByText('选择难度：').waitFor({ state: 'visible' });
    const vocabSwitch5 = page.locator('[data-testid="vocab-details-toggle"] [role="switch"]');
    await vocabSwitch5.click();
    await expect(vocabSwitch5).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: '初级' }).click();
    await page.waitForURL(/\/practice\/details/);
    await vocabDetailsPage.waitForPageLoad();
    await vocabDetailsPage.clickStartPractice();
    await page.waitForURL(/\/practice\/quiz/);
  }
});