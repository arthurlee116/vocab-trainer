import { test, expect } from '@playwright/test';
import { LandingPage } from './pageObjects/LandingPage';
import { DashboardPage } from './pageObjects/DashboardPage';
import { TestHelpers, TEST_DATA } from './helpers/testHelpers';
import { mockDataManager } from './helpers/mockDataManager';

test.describe('认证流程测试', () => {
  let landingPage: LandingPage;
  let dashboardPage: DashboardPage;

  test.beforeEach(async ({ page }) => {
    landingPage = new LandingPage(page);
    dashboardPage = new DashboardPage(page);
    
    // 先导航到页面，确保可以访问localStorage
    await page.goto('/');
    
    // 清理本地存储
    await TestHelpers.clearLocalStorage(page);
    
    // Mock认证API
    await page.route('**/api/auth/register', async (route) => {
      const postData = await route.request().postData();
      const { email, password } = JSON.parse(postData || '{}');
      
      if (email && password && email.includes('@') && password.length >= 6) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDataManager.getAuthResponse('register', email))
        });
      } else {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid email or password' })
        });
      }
    });

    await page.route('**/api/auth/login', async (route) => {
      const postData = await route.request().postData();
      const { email, password } = JSON.parse(postData || '{}');
      
      if (email === TEST_DATA.VALID_EMAIL && password === TEST_DATA.VALID_PASSWORD) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockDataManager.getAuthResponse('login', email))
        });
      } else {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid credentials' })
        });
      }
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockDataManager.getMockData('auth-profile'))
      });
    });
  });

  test.describe('用户注册流程', () => {
    test('应该能够成功注册新用户', async ({ page }) => {
      const testEmail = TestHelpers.generateTestEmail();
      const testPassword = TestHelpers.generateTestPassword();

      await landingPage.goto();
      await landingPage.switchToRegister();
      await landingPage.fillRegisterForm(testEmail, testPassword);
      await landingPage.clickRegister();

      // 验证跳转到Dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await dashboardPage.waitForPageLoad();
      
      // 验证Dashboard内容
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.uploadButton).toBeVisible();
    });

    test('应该显示注册错误信息', async ({ page }) => {
      // 禁用HTML5验证以测试服务器端验证
      await page.goto('/');
      await landingPage.switchToRegister();
      await page.evaluate(() => {
        const form = document.querySelector('form');
        if (form) form.setAttribute('novalidate', '');
      });
      
      await landingPage.fillRegisterForm(TEST_DATA.INVALID_EMAIL, TEST_DATA.INVALID_PASSWORD);
      await landingPage.clickRegister();

      // 等待错误消息显示
      await page.waitForSelector('.form-error', { state: 'visible', timeout: 5000 });
      
      // 验证错误消息（前端将HTTP 400转换为通用消息）
      const errorMessage = await landingPage.getErrorMessage();
      expect(errorMessage).toContain('status code 400');
      
      // 验证仍在登录页面
      await expect(landingPage.heading).toBeVisible();
    });

    test('应该验证邮箱格式', async ({ page }) => {
      await landingPage.goto();
      await landingPage.switchToRegister();
      await landingPage.fillRegisterForm('invalid-email', 'validpassword123');
      
      // 验证HTML5表单验证阻止提交
      const emailInput = landingPage.emailInput;
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(isValid).toBe(false);
      
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy();
    });

    test('应该验证密码长度', async ({ page }) => {
      await landingPage.goto();
      await landingPage.switchToRegister();
      await landingPage.fillRegisterForm('test@example.com', '123');
      
      // 验证HTML5表单验证阻止提交（密码最小长度为6）
      const passwordInput = landingPage.passwordInput;
      const isValid = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(isValid).toBe(false);
      
      const tooShort = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.tooShort);
      expect(tooShort).toBe(true);
    });
  });

  test.describe('用户登录流程', () => {
    test('应该能够成功登录', async ({ page }) => {
      await landingPage.login(TEST_DATA.VALID_EMAIL, TEST_DATA.VALID_PASSWORD);

      // 验证跳转到Dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await dashboardPage.waitForPageLoad();
      
      // 验证Dashboard内容
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.uploadButton).toBeVisible();
      await expect(dashboardPage.historyButton).toBeVisible();
      
      // 验证不是游客模式
      await expect(dashboardPage.guestModeNotice).not.toBeVisible();
    });

    test('应该显示登录错误信息', async ({ page }) => {
      await landingPage.goto();
      await landingPage.switchToLogin();
      await landingPage.fillLoginForm(TEST_DATA.VALID_EMAIL, 'wrongpassword');
      await landingPage.clickLogin();

      // 等待错误消息显示
      await page.waitForSelector('.form-error', { state: 'visible', timeout: 5000 });
      
      // 验证错误消息（前端将HTTP 401转换为通用消息）
      const errorMessage = await landingPage.getErrorMessage();
      expect(errorMessage).toContain('status code 401');
      
      // 验证仍在登录页面
      await expect(landingPage.heading).toBeVisible();
    });

    test('应该验证必填字段', async ({ page }) => {
      await landingPage.goto();
      await landingPage.switchToLogin();
      await landingPage.fillLoginForm('', '');
      
      // 验证HTML5表单验证阻止提交（required字段）
      const emailInput = landingPage.emailInput;
      const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
      expect(isValid).toBe(false);
      
      const valueMissing = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valueMissing);
      expect(valueMissing).toBe(true);
    });
  });

  test.describe('游客模式流程', () => {
    test('应该能够进入游客模式', async ({ page }) => {
      await landingPage.enterGuestMode();

      // 验证跳转到Dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await dashboardPage.waitForPageLoad();
      
      // 验证Dashboard内容
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.uploadButton).toBeVisible();
      
      // 验证游客模式提示
      await expect(dashboardPage.guestModeNotice).toBeVisible();
      await expect(dashboardPage.containsText('完成练习后可在报告页注册/登录')).toBeTruthy();
    });

    test('游客模式应该显示提示信息', async ({ page }) => {
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();

      // 游客模式下应该显示提示信息
      await expect(dashboardPage.guestModeNotice).toBeVisible();
      
      // 游客模式下历史记录按钮仍然可见和可用（会存储到localStorage）
      await expect(dashboardPage.historyButton).toBeVisible();
      await expect(dashboardPage.historyButton).toBeEnabled();
    });
  });

  test.describe('页面跳转验证', () => {
    test('注册成功后应该跳转到Dashboard', async ({ page }) => {
      const testEmail = TestHelpers.generateTestEmail();
      const testPassword = TestHelpers.generateTestPassword();

      await landingPage.goto();
      await landingPage.switchToRegister();
      await landingPage.fillRegisterForm(testEmail, testPassword);
      await landingPage.clickRegister();

      await expect(page).toHaveURL(/\/dashboard/);
      await dashboardPage.waitForPageLoad();
    });

    test('登录成功后应该跳转到Dashboard', async ({ page }) => {
      await landingPage.login(TEST_DATA.VALID_EMAIL, TEST_DATA.VALID_PASSWORD);

      await expect(page).toHaveURL(/\/dashboard/);
      await dashboardPage.waitForPageLoad();
    });

    test('游客模式应该跳转到Dashboard', async ({ page }) => {
      await landingPage.enterGuestMode();

      await expect(page).toHaveURL(/\/dashboard/);
      await dashboardPage.waitForPageLoad();
    });
  });

  test.describe('认证状态持久化', () => {
    test('已登录用户刷新页面应该保持登录状态', async ({ page }) => {
      await landingPage.login(TEST_DATA.VALID_EMAIL, TEST_DATA.VALID_PASSWORD);
      await dashboardPage.waitForPageLoad();

      // 刷新页面
      await page.reload();
      await dashboardPage.waitForPageLoad();

      // 验证仍在Dashboard
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.uploadButton).toBeVisible();
    });

    test('游客模式刷新页面应该保持游客状态', async ({ page }) => {
      await landingPage.enterGuestMode();
      await dashboardPage.waitForPageLoad();

      // 刷新页面
      await page.reload();
      await dashboardPage.waitForPageLoad();

      // 验证仍在Dashboard且显示游客提示
      await expect(dashboardPage.heading).toBeVisible();
      await expect(dashboardPage.guestModeNotice).toBeVisible();
    });
  });

  test.describe('表单交互', () => {
    test('应该能够切换登录和注册标签', async ({ page }) => {
      await landingPage.goto();
      
      // 默认应该是登录标签
      await expect(landingPage.loginButton).toBeVisible();
      
      // 切换到注册标签
      await landingPage.switchToRegister();
      await expect(landingPage.registerButton).toBeVisible();
      
      // 切换回登录标签
      await landingPage.switchToLogin();
      await expect(landingPage.loginButton).toBeVisible();
    });

    test('表单输入应该正常工作', async ({ page }) => {
      await landingPage.goto();
      await landingPage.switchToLogin();
      
      // 测试邮箱输入
      await landingPage.fillLoginForm('test@example.com', '');
      const emailValue = await landingPage.emailInput.inputValue();
      expect(emailValue).toBe('test@example.com');
      
      // 测试密码输入
      await landingPage.fillLoginForm('', 'password123');
      const passwordValue = await landingPage.passwordInput.inputValue();
      expect(passwordValue).toBe('password123');
    });
  });

  test.describe('网络错误处理', () => {
    test('网络错误时应该显示错误信息', async ({ page }) => {
      await landingPage.goto();
      
      // 重新设置Mock以模拟网络错误（会覆盖beforeEach中的Mock）
      await page.unroute('**/api/auth/login');
      await page.route('**/api/auth/login', async (route) => {
        await route.abort('failed');
      });

      await landingPage.switchToLogin();
      await landingPage.fillLoginForm(TEST_DATA.VALID_EMAIL, TEST_DATA.VALID_PASSWORD);
      await landingPage.clickLogin();

      // 等待错误消息显示
      await page.waitForSelector('.form-error', { state: 'visible', timeout: 5000 });
      
      // 验证错误处理
      const errorMessage = await landingPage.getErrorMessage();
      expect(errorMessage).toBeTruthy();
      
      // 验证仍在登录页面
      await expect(landingPage.heading).toBeVisible();
    });
  });
});