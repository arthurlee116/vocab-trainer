import { type Page, Locator } from '@playwright/test';
import { TestHelpers } from '../helpers/testHelpers';

export class DashboardPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly uploadButton: Locator;
  readonly historyButton: Locator;
  readonly guestModeNotice: Locator;
  readonly inProgressSessions: Locator;
  readonly statsSection: Locator;
  readonly startPracticeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { 
      name: '上传词表 → 选择难度 → 题流练习 → AI 分析' 
    });
    this.uploadButton = page.getByRole('button', { name: '开始新的练习' });
    this.historyButton = page.getByRole('button', { name: '查看历史记录' });
    this.guestModeNotice = page.getByText('完成练习后可在报告页注册/登录');
    this.inProgressSessions = page.locator('.in-progress-section');
    this.statsSection = page.locator('.stats-panel');
    this.startPracticeButton = page.getByRole('button', { name: '开始新的练习' });
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(): Promise<void> {
    await TestHelpers.waitForPageLoad(this.page, this.heading);
  }

  /**
   * 检查是否在Dashboard页面
   */
  async isOnDashboard(): Promise<boolean> {
    return await this.heading.isVisible();
  }

  /**
   * 点击上传词表按钮
   */
  async clickUploadButton(): Promise<void> {
    await this.uploadButton.click();
    await this.page.waitForURL(/\/practice\/upload/);
  }

  /**
   * 点击历史记录按钮
   */
  async clickHistoryButton(): Promise<void> {
    await this.historyButton.click();
    await this.page.waitForURL(/\/history/);
  }

  /**
   * 检查游客模式提示是否显示
   */
  async isGuestModeNoticeVisible(): Promise<boolean> {
    return await this.guestModeNotice.isVisible();
  }

  /**
   * 检查是否有进行中的练习
   */
  async hasInProgressSessions(): Promise<boolean> {
        return await this.inProgressSessions.isVisible() && 
          (await this.inProgressSessions.locator('.in-progress-card').count()) > 0;
  }

  /**
   * 获取进行中的练习数量
   */
  async getInProgressSessionCount(): Promise<number> {
    if (!await this.inProgressSessions.isVisible()) {
      return 0;
    }
    return await this.inProgressSessions.locator('.in-progress-card').count();
  }

  /**
   * 点击特定的进行中练习
   */
  async clickInProgressSession(sessionIndex: number = 0): Promise<void> {
    const sessionCard = this.inProgressSessions.locator('.in-progress-card').nth(sessionIndex);
    await sessionCard.click();
    await this.page.waitForURL(/\/practice\/quiz/);
  }

  /**
   * 检查统计信息是否显示
   */
  async isStatsSectionVisible(): Promise<boolean> {
    return await this.statsSection.isVisible();
  }

  /**
   * 获取学习统计信息
   */
  async getLearningStats(): Promise<{
    wordsLearned?: string;
    sessionsCompleted?: string;
    weeklyActivity?: string;
  }> {
    if (!await this.statsSection.isVisible()) {
      return {};
    }

    // The dashboard uses stat-card elements; map them by label for robust selection
    const cards = this.statsSection.locator('.stat-card');
    const count = await cards.count();
    let wordsLearned: string | undefined;
    let sessionsCompleted: string | undefined;
    let weeklyActivity: string | undefined;

    for (let i = 0; i < count; i++) {
      const card = cards.nth(i);
      const label = (await card.locator('.stat-label').textContent())?.trim();
      const number = (await card.locator('.stat-number').textContent())?.trim();
      if (!label || !number) continue;
      if (label.includes('学习单词')) wordsLearned = number;
      else if (label.includes('完成练习')) sessionsCompleted = number;
      else if (label.includes('本周练习')) weeklyActivity = number;
    }

    return { wordsLearned, sessionsCompleted, weeklyActivity };
  }

  /**
   * 点击开始练习按钮
   */
  async clickStartPractice(): Promise<void> {
    await this.startPracticeButton.click();
    await this.page.waitForURL(/\/practice\/upload/);
  }

  /**
   * 检查页面是否包含特定文本
   */
  async containsText(text: string): Promise<boolean> {
    return await this.page.getByText(text).isVisible();
  }

  /**
   * 等待特定元素出现
   */
  async waitForElement(selector: string): Promise<void> {
    await this.page.waitForSelector(selector, { state: 'visible' });
  }

  /**
   * 获取页面标题
   */
  async getPageTitle(): Promise<string> {
    return await this.page.title();
  }
}