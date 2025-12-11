import { type Page, Locator } from '@playwright/test';
import { TestHelpers } from '../helpers/testHelpers';

export class LandingPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly loginTab: Locator;
  readonly registerTab: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerButton: Locator;
  readonly guestModeButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'AI 动态词汇练习' });
    // Use more specific selectors for tabs
    this.loginTab = page.locator('.auth-tabs button', { hasText: '登录' });
    this.registerTab = page.locator('.auth-tabs button', { hasText: '注册' });
    this.emailInput = page.getByLabel('邮箱');
    this.passwordInput = page.getByLabel('密码');
    // Use more specific selectors for submit buttons
    this.loginButton = page.locator('form button[type="submit"]', { hasText: '登录' });
    this.registerButton = page.locator('form button[type="submit"]', { hasText: '注册并登录' });
    this.guestModeButton = page.getByRole('button', { name: '先逛逛（游客模式）' });
    this.errorMessage = page.locator('.form-error');
  }

  /**
   * 导航到登录页面
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await TestHelpers.waitForPageLoad(this.page, this.heading);
  }

  /**
   * 切换到登录标签
   */
  async switchToLogin(): Promise<void> {
    await this.loginTab.click();
  }

  /**
   * 切换到注册标签
   */
  async switchToRegister(): Promise<void> {
    await this.registerTab.click();
  }

  /**
   * 填写登录表单
   */
  async fillLoginForm(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * 填写注册表单
   */
  async fillRegisterForm(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /**
   * 点击登录按钮
   */
  async clickLogin(): Promise<void> {
    await this.loginButton.click();
  }

  /**
   * 点击注册按钮
   */
  async clickRegister(): Promise<void> {
    await this.registerButton.click();
  }

  /**
   * 点击游客模式按钮
   */
  async clickGuestMode(): Promise<void> {
    await this.guestModeButton.click();
  }

  /**
   * 执行完整的登录流程
   */
  async login(email: string, password: string): Promise<void> {
    await this.goto();
    await this.switchToLogin();
    await this.fillLoginForm(email, password);
    await this.clickLogin();
    await this.page.waitForURL(/\/dashboard/);
  }

  /**
   * 执行完整的注册流程
   */
  async register(email: string, password: string): Promise<void> {
    await this.goto();
    await this.switchToRegister();
    await this.fillRegisterForm(email, password);
    await this.clickRegister();
    await this.page.waitForURL(/\/dashboard/);
  }

  /**
   * 进入游客模式
   */
  async enterGuestMode(): Promise<void> {
    await this.goto();
    await this.switchToRegister();
    await this.clickGuestMode();
    await this.page.waitForURL(/\/dashboard/);
  }

  /**
   * 获取错误消息文本
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.errorMessage.isVisible()) {
      return await this.errorMessage.textContent();
    }
    return null;
  }

  /**
   * 检查是否在登录页面
   */
  async isOnLandingPage(): Promise<boolean> {
    return await this.heading.isVisible();
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(): Promise<void> {
    await TestHelpers.waitForPageLoad(this.page, this.heading);
  }
}