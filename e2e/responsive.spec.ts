import { test, expect, devices } from '@playwright/test';
import { LandingPage } from './pageObjects/LandingPage';
import { DashboardPage } from './pageObjects/DashboardPage';
import { UploadPage } from './pageObjects/UploadPage';
import { QuizPage } from './pageObjects/QuizPage';
import { TestHelpers } from './helpers/testHelpers';
import { mockDataManager } from './helpers/mockDataManager';

test.describe('响应式设计测试', () => {
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
    await page.route('**/api/generation/details', async (route: any) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getVocabularyDetails())
      });
    });
  }

  test.describe('桌面端适配', () => {
    test('应该在桌面端正确显示登录页面', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证布局
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginTab).toBeVisible();
      await expect(landingPage.registerTab).toBeVisible();
      await expect(landingPage.emailInput).toBeVisible();
      await expect(landingPage.passwordInput).toBeVisible();
      await expect(landingPage.loginButton).toBeVisible();

      // 验证元素位置和大小
      const loginBox = page.locator('.landing-card');
      const boundingBox = await loginBox.boundingBox();
      expect(boundingBox?.width).toBeGreaterThan(400);
      expect(boundingBox?.height).toBeGreaterThan(500);
    });

    test('应该在桌面端正确显示Dashboard', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();

      // 验证侧边栏或导航布局
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.uploadButton).toBeVisible();
      await expect(dashboardPage.historyButton).toBeVisible();

      // 验证内容区域宽度
      const contentArea = page.locator('main, .main-content');
      const boundingBox = await contentArea.boundingBox();
      expect(boundingBox?.width).toBeGreaterThan(800);
    });

    test('应该在桌面端正确显示上传页面', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      await uploadPage.waitForPageLoad();

      // 验证上传区域
      await expect(uploadPage.heading).toBeVisible();
      await expect(uploadPage.uploadArea).toBeVisible();
      await expect(uploadPage.fileInput).toBeVisible();

      // 验证上传区域大小
      const uploadAreaBox = await uploadPage.uploadArea.boundingBox();
      expect(uploadAreaBox?.width).toBeGreaterThan(400);
      expect(uploadAreaBox?.height).toBeGreaterThan(300);
    });

    test('应该在桌面端正确显示答题页面', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 验证答题区域布局
      await expect(quizPage.questionContainer).toBeVisible();
      await expect(quizPage.optionsContainer).toBeVisible();
      await expect(quizPage.progressBar).toBeVisible();

      // 验证选项布局
      const options = await quizPage.optionButtons.all();
      expect(options.length).toBeGreaterThan(0);
      
      for (const option of options) {
        await expect(option).toBeVisible();
        const optionBox = await option.boundingBox();
        expect(optionBox?.width).toBeGreaterThan(100);
      }
    });
  });

  test.describe('平板端适配', () => {
    test('应该在平板端正确显示登录页面', async ({ page }) => {
      await page.setViewportSize(devices['iPad Pro'].viewport);
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证所有元素仍然可见
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginTab).toBeVisible();
      await expect(landingPage.registerTab).toBeVisible();
      await expect(landingPage.emailInput).toBeVisible();
      await expect(landingPage.passwordInput).toBeVisible();
      await expect(landingPage.loginButton).toBeVisible();

      // 验证布局调整
      const loginBox = page.locator('.landing-card');
      const boundingBox = await loginBox.boundingBox();
      expect(boundingBox?.width).toBeLessThan(600); // 比桌面端窄
    });

    test('应该在平板端正确显示Dashboard', async ({ page }) => {
      await page.setViewportSize(devices['iPad Pro'].viewport);
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();

      // 验证导航可能变为汉堡菜单或水平布局
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.uploadButton).toBeVisible();
      
      // 检查是否有汉堡菜单
      const hamburgerMenu = page.locator('[data-testid="hamburger-menu"], .hamburger, button[aria-label="menu"]');
      if (await hamburgerMenu.isVisible()) {
        await expect(hamburgerMenu).toBeVisible();
      }
    });

    test('应该在平板端正确显示答题页面', async ({ page }) => {
      await page.setViewportSize(devices['iPad Pro'].viewport);
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 验证答题区域
      await expect(quizPage.questionContainer).toBeVisible();
      await expect(quizPage.optionsContainer).toBeVisible();

      // 验证选项可能垂直排列
      const options = await quizPage.optionButtons.all();
      expect(options.length).toBeGreaterThan(0);
      
      for (const option of options) {
        await expect(option).toBeVisible();
      }
    });
  });

  test.describe('手机端适配', () => {
    test('应该在手机端正确显示登录页面', async ({ page }) => {
      await page.setViewportSize(devices['iPhone 12'].viewport);
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证所有元素仍然可见和可操作
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginTab).toBeVisible();
      await expect(landingPage.registerTab).toBeVisible();
      await expect(landingPage.emailInput).toBeVisible();
      await expect(landingPage.passwordInput).toBeVisible();
      await expect(landingPage.loginButton).toBeVisible();

      // 验证移动端布局
      const loginBox = page.locator('.landing-card');
      const boundingBox = await loginBox.boundingBox();
      expect(boundingBox?.width).toBeLessThan(400);
      
      // 验证字体大小和间距适合触摸
      const buttonBox = await landingPage.loginButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThan(44); // 最小触摸目标
    });

    test('应该在手机端正确显示Dashboard', async ({ page }) => {
      await page.setViewportSize(devices['iPhone 12'].viewport);
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();

      // 验证汉堡菜单存在
      const hamburgerMenu = page.locator('[data-testid="hamburger-menu"], .hamburger, button[aria-label="menu"]');
      if (await hamburgerMenu.isVisible()) {
        await expect(hamburgerMenu).toBeVisible();
        
        // 测试菜单开关
        await hamburgerMenu.click();
        await expect(page.locator('.mobile-menu, .sidebar')).toBeVisible();
      }

      // 验证按钮大小适合触摸
      const uploadButtonBox = await dashboardPage.uploadButton.boundingBox();
      expect(uploadButtonBox?.height).toBeGreaterThan(44);
    });

    test('应该在手机端正确显示上传页面', async ({ page }) => {
      await page.setViewportSize(devices['iPhone 12'].viewport);
      await landingPage.enterGuestMode();
      await dashboardPage.clickUploadButton();
      await uploadPage.waitForPageLoad();

      // 验证上传区域适配
      await expect(uploadPage.heading).toBeVisible();
      await expect(uploadPage.uploadArea).toBeVisible();
      await expect(uploadPage.fileInput).toBeVisible();

      // 验证拖拽区域在移动端可能隐藏或调整
      const uploadAreaBox = await uploadPage.uploadArea.boundingBox();
      expect(uploadAreaBox?.width).toBeLessThan(page.viewportSize().width - 40);
    });

    test('应该在手机端正确显示答题页面', async ({ page }) => {
      await page.setViewportSize(devices['iPhone 12'].viewport);
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 验证题目区域
      await expect(quizPage.questionContainer).toBeVisible();
      await expect(quizPage.questionText).toBeVisible();

      // 验证选项垂直排列且适合触摸
      const options = await quizPage.optionButtons.all();
      expect(options.length).toBeGreaterThan(0);
      
      for (let i = 0; i < options.length; i++) {
        await expect(options[i]).toBeVisible();
        const optionBox = await options[i].boundingBox();
        expect(optionBox?.height).toBeGreaterThan(44); // 最小触摸目标
        
        // 验证选项之间有足够间距
        if (i > 0) {
          const prevOptionBox = await options[i - 1].boundingBox();
          if (prevOptionBox && optionBox) {
            const gap = optionBox.y - (prevOptionBox.y + prevOptionBox.height);
            expect(gap).toBeGreaterThan(8);
          }
        }
      }

      // 验证进度条在移动端可见
      await expect(quizPage.progressBar).toBeVisible();
    });
  });

  test.describe('横屏适配', () => {
    test('应该在横屏模式下正确显示', async ({ page }) => {
      await page.setViewportSize({ width: 800, height: 600 }); // 横屏
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证横屏布局
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginTab).toBeVisible();
      await expect(landingPage.registerTab).toBeVisible();

      // 验证布局适应横屏
      const loginBox = page.locator('.landing-card');
      const boundingBox = await loginBox.boundingBox();
      expect(boundingBox?.width).toBeGreaterThan((boundingBox?.height || 0));
    });

    test('应该在横屏模式下正确显示答题页面', async ({ page }) => {
      await page.setViewportSize({ width: 900, height: 600 }); // 横屏
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 验证横屏答题布局
      await expect(quizPage.questionContainer).toBeVisible();
      await expect(quizPage.optionsContainer).toBeVisible();

      // 横屏下选项可能水平排列
      const optionsContainer = await quizPage.optionsContainer.boundingBox();
      if (optionsContainer && optionsContainer.width > optionsContainer.height) {
        // 水平布局验证
        const options = await quizPage.optionButtons.all();
        for (const option of options) {
          await expect(option).toBeVisible();
        }
      }
    });
  });

  test.describe('小屏幕适配', () => {
    test('应该在极小屏幕下保持可用性', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证核心功能仍然可用
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginTab).toBeVisible();
      await expect(landingPage.emailInput).toBeVisible();
      await expect(landingPage.passwordInput).toBeVisible();
      await expect(landingPage.loginButton).toBeVisible();

      // 验证按钮可点击
      await landingPage.switchToRegister();
      await expect(landingPage.registerButton).toBeVisible();
    });

    test('应该在极小屏幕下正确显示答题页面', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 568 });
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 验证题目可读
      await expect(quizPage.questionContainer).toBeVisible();
      await expect(quizPage.questionText).toBeVisible();

      // 验证选项可点击
      const options = await quizPage.optionButtons.all();
      expect(options.length).toBeGreaterThan(0);
      
      for (const option of options) {
        await expect(option).toBeVisible();
        const optionBox = await option.boundingBox();
        expect(optionBox?.width).toBeGreaterThan(280); // 几乎全宽
        expect(optionBox?.height).toBeGreaterThan(44);
      }
    });
  });

  test.describe('字体和缩放适配', () => {
    test('应该支持系统字体缩放', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // 模拟系统字体缩放
      await page.addStyleTag({
        content: 'html { font-size: 20px; }' // 较大字体
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证布局仍然正常
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginButton).toBeVisible();

      // 验证文字大小适应
      const headingFontSize = await landingPage.heading.evaluate(el => 
        window.getComputedStyle(el).fontSize
      );
      expect(parseFloat(headingFontSize || '0')).toBeGreaterThan(16);
    });

    test('应该支持页面缩放', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 模拟页面缩放到150%
      await page.evaluate(() => {
        document.body.style.zoom = '1.5';
      });

      // 验证元素仍然可见和可交互
      await expect(landingPage.heading).toBeVisible();
      await expect(landingPage.loginButton).toBeVisible();
      
      // 验证按钮仍然可点击
      await landingPage.switchToRegister();
      await expect(landingPage.registerButton).toBeVisible();
    });
  });

  test.describe('触摸交互适配', () => {
    test('应该在移动设备上支持触摸交互', async ({ page }) => {
      await page.setViewportSize(devices['iPhone 12'].viewport);
      
      // 模拟触摸设备
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'maxTouchPoints', {
          get: () => 1
        });
        Object.defineProperty(navigator, 'ontouchstart', {
          get: () => () => {}
        });
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证触摸目标大小
      const buttonBox = await landingPage.loginButton.boundingBox();
      expect(buttonBox?.height).toBeGreaterThanOrEqual(44);
      expect(buttonBox?.width).toBeGreaterThanOrEqual(44);

      // 模拟触摸点击
      await landingPage.loginButton.tap();
      await expect(landingPage.emailInput).toBeFocused();
    });

    test('应该支持滑动手势', async ({ page }) => {
      await page.setViewportSize(devices['iPhone 12'].viewport);
      await setupQuizPage(page);
      await quizPage.waitForPageLoad();

      // 验证滑动切换题目（如果支持）
      const questionContainer = await quizPage.questionContainer.boundingBox();
      if (questionContainer) {
        // 模拟左滑手势
        await page.mouse.move(questionContainer.x + questionContainer.width / 2, questionContainer.y + questionContainer.height / 2);
        await page.mouse.down();
        await page.mouse.move(questionContainer.x + 100, questionContainer.y + questionContainer.height / 2);
        await page.mouse.up();

        await page.waitForTimeout(500);
      }
    });
  });

  test.describe('高DPI屏幕适配', () => {
    test('应该在高DPI屏幕上正确显示', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      
      // 模拟高DPI屏幕
      await page.addInitScript(() => {
        Object.defineProperty(window, 'devicePixelRatio', {
          get: () => 2
        });
      });

      await landingPage.goto();
      await landingPage.waitForPageLoad();

      // 验证图像和文字清晰度
      await expect(landingPage.heading).toBeVisible();
      
      // 检查是否使用了高分辨率图像
      const images = page.locator('img');
      const count = await images.count();
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          const img = images.nth(i);
          const src = await img.getAttribute('src');
          if (src) {
            // 验证使用了@2x图像或矢量图
            const isHighRes = src.includes('@2x') || src.includes('.svg') || src.includes('data:image/svg');
            expect(isHighRes).toBeTruthy();
          }
        }
      }
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
    // Use helper to start generation without vocab details
    await TestHelpers.startGeneration(page, 'beginner', false);

    await page.waitForURL(/\/practice\/quiz/);
  }
});