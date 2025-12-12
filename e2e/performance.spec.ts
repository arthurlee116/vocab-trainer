import { test, expect } from '@playwright/test';
import { LandingPage } from './pageObjects/LandingPage';
import { DashboardPage } from './pageObjects/DashboardPage';
import { UploadPage } from './pageObjects/UploadPage';
import { QuizPage } from './pageObjects/QuizPage';
import { TestHelpers } from './helpers/testHelpers';
import { mockDataManager } from './helpers/mockDataManager';

test.describe('性能测试', () => {
  let landingPage: LandingPage;
  let dashboardPage: DashboardPage;
  let uploadPage: UploadPage;
  let quizPage: QuizPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    dashboardPage = new DashboardPage(page);
    uploadPage = new UploadPage(page);
    quizPage = new QuizPage(page);
    
    // 先导航到页面，确保可以访问localStorage
    await page.goto('/');
    
    // 清理本地存储
    await TestHelpers.clearLocalStorage(page);
    
    // Mock基本API
    await setupBasicMocks(page);
  });

  async function setupBasicMocks(page: any) {
    await page.route('**/api/vlm/extract', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getVLMSuccessResponse())
      });
    });

    await page.route('**/api/generation/session', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getGenerationSessionResponse())
      });
    });

    // Ensure GET polling requests are intercepted as well
    await page.route('**/api/generation/session/*', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getGenerationSessionResponse())
      });
    });

    await page.route('**/api/analysis/report', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getAnalysisResponse(85))
      });
    });

    // Mock vocabulary details API to ensure stable runs when details are requested
    await page.route('**/api/generation/details', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getVocabularyDetails())
      });
    });
  }

  test.describe('页面加载性能', () => {
    test('首页加载时间应该在合理范围内', async ({ page }) => {
      const startTime = Date.now();
      
      await landingPage.goto();
      await landingPage.waitForPageLoad();
      
      const loadTime = Date.now() - startTime;
      
      // 首页加载时间应小于3秒
      expect(loadTime).toBeLessThan(3000);
      
      // 验证关键性能指标
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime || 0
        };
      });

      expect(performanceMetrics.domContentLoaded).toBeLessThan(2000);
      expect(performanceMetrics.loadComplete).toBeLessThan(3000);
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(1500);
    });

    test('Dashboard加载时间应该在合理范围内', async ({ page }) => {
      await landingPage.enterGuestMode();
      
      const startTime = Date.now();
      await dashboardPage.waitForPageLoad();
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(2000);
    });

    test('上传页面加载时间应该在合理范围内', async ({ page }) => {
      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      
      const startTime = Date.now();
      await uploadPage.waitForPageLoad();
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(2000);
    });

    test('答题页面加载时间应该在合理范围内', async ({ page }) => {
      await setupQuizPage(page);
      
      const startTime = Date.now();
      await quizPage.waitForPageLoad();
      const loadTime = Date.now() - startTime;
      
      expect(loadTime).toBeLessThan(3000); // 答题页面可能需要加载更多数据
    });
  });

  test.describe('资源加载性能', () => {
    test('应该合理加载静态资源', async ({ page }) => {
      const responses: any[] = [];
      
      page.on('response', response => {
        if (response.url().includes('.js') || response.url().includes('.css') || response.url().includes('.png') || response.url().includes('.jpg')) {
          responses.push({
            url: response.url(),
            status: response.status(),
            size: response.headers()['content-length']
          });
        }
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证关键资源加载成功
      const jsResponses = responses.filter(r => r.url.includes('.js'));
      const cssResponses = responses.filter(r => r.url.includes('.css'));
      
      expect(jsResponses.length).toBeGreaterThan(0);
      expect(cssResponses.length).toBeGreaterThan(0);
      
      // 验证没有失败的资源
      const failedResponses = responses.filter(r => r.status >= 400);
      expect(failedResponses.length).toBe(0);
    });

    test('应该使用适当的缓存策略', async ({ page }) => {
      const responses: any[] = [];
      
      page.on('response', response => {
        const cacheControl = response.headers()['cache-control'];
        if (cacheControl) {
          responses.push({
            url: response.url(),
            cacheControl
          });
        }
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证静态资源有缓存策略
      const staticResources = responses.filter(r => 
        r.url.includes('.js') || r.url.includes('.css') || r.url.includes('.png')
      );
      
      const cachedResources = staticResources.filter(r => 
        r.cacheControl && (r.cacheControl.includes('max-age') || r.cacheControl.includes('immutable'))
      );
      
      expect(cachedResources.length).toBeGreaterThan(0);
    });
  });

  test.describe('大数据量处理性能', () => {
    test('应该能处理大量词汇的图片', async ({ page }) => {
      // Mock大量词汇响应
      const manyWords = Array.from({ length: 100 }, (_, i) => `word${i + 1}`);
      
      await page.route('**/api/vlm/extract', async (route: any) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ words: manyWords })
        });
      });

      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      await uploadPage.waitForPageLoad();

      const startTime = Date.now();
      await uploadPage.uploadFile('e2e/test-data/images/large-vocabulary.jpg');
      await uploadPage.clickStartRecognition();
      await uploadPage.waitForRecognitionComplete();
      const processingTime = Date.now() - startTime;

      // 大量词汇处理时间应合理
      expect(processingTime).toBeLessThan(10000);
    });

    test('应该能处理大量题目生成', async ({ page }) => {
      // Mock大量题目响应
      const manyWords = Array.from({ length: 50 }, (_, i) => `word${i + 1}`);
      const largeResponse = mockDataManager.generateTestQuestions(manyWords);
      
      await page.route('**/api/generation/session', async (route: any) => {
        // 模拟生成延迟
        await new Promise(resolve => setTimeout(resolve, 2000));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(largeResponse)
        });
      });

      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      await uploadPage.mockVLMResponse(mockDataManager.getVLMSuccessResponse(manyWords));
      await uploadPage.uploadFile('e2e/test-data/images/large-vocabulary.jpg');
      await uploadPage.clickStartRecognition();
      await uploadPage.waitForRecognitionComplete();
      await uploadPage.waitForRedirectToConfirm();

      await page.waitForTimeout(2000);
      // Use TestHelpers helper to start generation (no vocab details)
      await TestHelpers.startGeneration(page, 'beginner', false);
      const startTime = Date.now();
      await page.waitForURL(/\/practice\/quiz/);
      const generationTime = Date.now() - startTime;

      // 大量题目生成时间应合理
      expect(generationTime).toBeLessThan(15000);
    });

    test('应该能处理长时间答题会话', async ({ page }) => {
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 模拟长时间答题
      const startTime = Date.now();
      let answerCount = 0;
      
      // 答答多道题目
      for (let i = 0; i < 10; i++) {
        await quizPage.waitForQuestionLoad();
        
        const options = await quizPage.getOptions();
        if (options.length > 0) {
          await quizPage.selectOption(options[0]);
          await quizPage.clickNext();
          answerCount++;
        }
        
        // 检查内存使用情况
        if (i % 3 === 0) {
          const memoryUsage = await page.evaluate(() => {
            const perf = performance as any;
            if (perf.memory) {
              return {
                used: perf.memory.usedJSHeapSize,
                total: perf.memory.totalJSHeapSize
              };
            }
            return null;
          });
          
          if (memoryUsage) {
            // 内存使用应该相对稳定
            expect(memoryUsage.used).toBeLessThan(memoryUsage.total * 0.8);
          }
        }
      }
      
      const totalTime = Date.now() - startTime;
      const averageTimePerQuestion = totalTime / answerCount;
      
      // 每题平均答题时间应合理
      expect(averageTimePerQuestion).toBeLessThan(30000); // 30秒内
      expect(answerCount).toBeGreaterThan(5); // 至少完成几题
    });
  });

  test.describe('交互响应性能', () => {
    test('按钮点击响应应该及时', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 测试按钮点击响应时间
      const clickTimes: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = Date.now();
        await landingPage.switchToLogin();
        await landingPage.switchToRegister();
        const responseTime = Date.now() - startTime;
        clickTimes.push(responseTime);
      }
      
      const averageResponseTime = clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length;
      
      // 平均响应时间应小于200ms
      expect(averageResponseTime).toBeLessThan(200);
    });

    test('表单输入应该流畅', async ({ page }) => {
      await landingPage.goto();
      await landingPage.switchToLogin();
      
      // 测试输入响应
      const testText = 'test@example.com';
      const startTime = Date.now();
      
      await landingPage.fillLoginForm(testText, 'password123');
      
      const inputTime = Date.now() - startTime;
      
      // 输入响应时间应小于500ms
      expect(inputTime).toBeLessThan(500);
      
      // 验证输入值正确
      const emailValue = await landingPage.emailInput.inputValue();
      expect(emailValue).toBe(testText);
    });

    test('页面切换应该流畅', async ({ page }) => {
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();
      
      const switchTimes: number[] = [];
      
      // 测试页面切换性能
      const pages = [
        () => dashboardPage.clickUploadButton(),
        () => page.goBack(),
        () => dashboardPage.clickHistoryButton(),
        () => page.goBack()
      ];
      
      for (const pageAction of pages) {
        const startTime = Date.now();
        await pageAction();
        await page.waitForTimeout(1000); // 等待页面稳定
        const switchTime = Date.now() - startTime;
        switchTimes.push(switchTime);
      }
      
      const averageSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;
      
      // 页面切换时间应小于1秒
      expect(averageSwitchTime).toBeLessThan(1000);
    });
  });

  test.describe('内存和CPU使用', () => {
    test('应该控制内存使用', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();
      
      const initialMemory = await page.evaluate(() => {
        const perf = performance as any;
        if (perf.memory) {
          return perf.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // 执行一系列操作
      await landingPage.switchToLogin();
      await landingPage.switchToRegister();
      await landingPage.fillLoginForm('test@example.com', 'password123');
      await landingPage.switchToLogin();
      
      const finalMemory = await page.evaluate(() => {
        const perf = performance as any;
        if (perf.memory) {
          return perf.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // 内存增长应该控制在合理范围内
      const memoryIncrease = finalMemory - initialMemory;
      const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
      
      expect(memoryIncreasePercent).toBeLessThan(50); // 内存增长不超过50%
    });

    test('应该避免内存泄漏', async ({ page }) => {
      await landingPage.goto();
      await landingPage.waitForPageLoad();
      
      // 多次执行相同操作
      for (let i = 0; i < 10; i++) {
        await landingPage.switchToLogin();
        await landingPage.switchToRegister();
        await landingPage.fillLoginForm(`test${i}@example.com`, 'password123');
        await landingPage.emailInput.fill('');
        await landingPage.passwordInput.fill('');
      }
      
      // 强制垃圾回收
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      const finalMemory = await page.evaluate(() => {
        const perf = performance as any;
        if (perf.memory) {
          return perf.memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // 内存应该稳定
      const baselineMemory = 50 * 1024 * 1024; // 50MB基准
      expect(finalMemory).toBeLessThan(baselineMemory * 2); // 不超过基准的2倍
    });
  });

  test.describe('网络性能', () => {
    test('应该优化API请求', async ({ page }) => {
      const requests: any[] = [];
      
      page.on('request', request => {
        if (request.url().includes('/api/')) {
          requests.push({
            url: request.url(),
            method: request.method(),
            headers: request.headers()
          });
        }
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证没有重复请求
      const uniqueUrls = new Set(requests.map(r => r.url));
      expect(uniqueUrls.size).toBe(requests.length);
      
      // 验证使用了适当的缓存头
      const apiRequests = requests.filter(r => r.url.includes('/api/'));
      for (const request of apiRequests) {
        expect(request.headers['accept']).toBeTruthy();
      }
    });

    test('应该处理慢网络', async ({ page }) => {
      // 模拟慢网络
      await page.route('**/api/**', async (route: any) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒延迟
        await route.continue();
      });

      const startTime = Date.now();
      await landingPage.goto();
      await landingPage.waitForPageLoad();
      const loadTime = Date.now() - startTime;

      // 即使在慢网络下，页面也应该可用
      expect(loadTime).toBeLessThan(10000);
      
      // 验证加载状态显示
      await expect(landingPage.heading).toBeVisible();
    });
  });

  test.describe('渲染性能', () => {
    test('应该避免布局抖动', async ({ page }) => {
      await landingPage.goto();
      
      // 监控布局变化
      const layoutShifts: number[] = [];
      
      await page.addInitScript(() => {
        new PerformanceObserver((list: any) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'layout-shift') {
              (window as any).layoutShifts = (window as any).layoutShifts || [];
              (window as any).layoutShifts.push(entry.value);
            }
          }
        }).observe({ entryTypes: ['layout-shift'] });
      });

      await landingPage.waitForPageLoad();
      
      // 执行一些操作
      await landingPage.switchToLogin();
      await landingPage.switchToRegister();
      await landingPage.fillLoginForm('test@example.com', 'password123');
      
      const totalLayoutShift = await page.evaluate(() => (window as any).layoutShifts?.reduce((a: number, b: number) => a + b, 0) || 0);
      
      // 累积布局偏移应小于0.1
      expect(totalLayoutShift).toBeLessThan(0.1);
    });

    test('应该保持高帧率', async ({ page }) => {
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();
      
      // 测试动画和交互的帧率
      const frameRates: number[] = [];
      
      for (let i = 0; i < 5; i++) {
        const startTime = performance.now();
        
        await quizPage.selectOptionByIndex(0);
        await quizPage.clickNext();
        
        const endTime = performance.now();
        const frameTime = endTime - startTime;
        const frameRate = 1000 / frameTime;
        
        frameRates.push(frameRate);
      }
      
      const averageFrameRate = frameRates.reduce((a, b) => a + b, 0) / frameRates.length;
      
      // 平均帧率应大于30fps
      expect(averageFrameRate).toBeGreaterThan(30);
    });
  });

  // 辅助函数：设置答题页面
  async function setupQuizPage(page: any) {
    await landingPage.enterGuestMode();
    await dashboardPage.clickUploadButton();
    await uploadPage.uploadFile('e2e/test-data/images/valid-vocabulary.jpg');
    await uploadPage.clickStartRecognition();
    await uploadPage.waitForRecognitionComplete();
    await uploadPage.waitForRedirectToConfirm();

    await page.waitForTimeout(2000);
    // Use helper to start generation without vocab details so it navigates directly to quiz
    await TestHelpers.startGeneration(page, 'beginner', false);
    await page.waitForURL(/\/practice\/quiz/);
  }
});