import { test, type Page, type Locator } from '@playwright/test';
import type { DifficultyLevel } from '../../client/src/types';

export class TestHelpers {
  /**
   * 等待页面加载完成并检查关键元素
   */
  static async waitForPageLoad(page: Page, expectedElement: Locator): Promise<void> {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      expectedElement.waitFor({ state: 'visible' })
    ]);
  }

  /**
   * 模拟用户登录
   */
  static async loginUser(page: Page, email: string, password: string): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: '登录' }).click();
    await page.getByLabel('邮箱').fill(email);
    await page.getByLabel('密码').fill(password);
    await page.getByRole('button', { name: '登录' }).click();
    await page.waitForURL(/\/dashboard/);
  }

  /**
   * 模拟用户注册
   */
  static async registerUser(page: Page, email: string, password: string): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: '注册' }).click();
    await page.getByLabel('邮箱').fill(email);
    await page.getByLabel('密码').fill(password);
    await page.getByRole('button', { name: '注册并登录' }).click();
    await page.waitForURL(/\/dashboard/);
  }

  /**
   * 进入游客模式
   */
  static async enterGuestMode(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: '注册' }).click();
    await page.getByRole('button', { name: '先逛逛（游客模式）' }).click();
    await page.waitForURL(/\/dashboard/);
  }

  /**
   * 上传测试图片
   */
  static async uploadTestImage(page: Page, imagePath: string): Promise<void> {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(imagePath);
    
    // 等待上传开始并完成 - 匹配上传过程中可能显示的文本
    await page.getByText(/AI 正在阅读.*张图片/).waitFor({ state: 'visible' });
    await page.getByText(/AI 正在阅读.*张图片/).waitFor({ state: 'hidden', timeout: 30000 });
  }

  /**
   * 选择难度级别
   */
  static async selectDifficulty(page: Page, difficulty: DifficultyLevel): Promise<void> {
    const labelMap = {
      beginner: '初级',
      intermediate: '中级',
      advanced: '高级',
    } as const;
    await page.getByRole('button', { name: labelMap[difficulty] }).click();
  }

  /**
   * 开始生成题目
   */
  static async startGeneration(
    page: Page,
    difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner',
    enableVocabDetails: boolean = true,
  ): Promise<void> {
    // 点击确认按钮以显示难度选项
    await page.getByRole('button', { name: '确认，开始练习' }).click();
    if (enableVocabDetails) {
      // Click the inner switch element to reliably toggle the state
      const vocabSwitch = page.locator('[data-testid="vocab-details-toggle"] [role="switch"]');
      await vocabSwitch.click();
    }

    await TestHelpers.selectDifficulty(page, difficulty);
    // 等待生成/跳转 — 当启用词汇详情时，某些情况下应用可能会直接跳转到 /practice/quiz（详情失败或跳过），因此接受两种可能
    if (enableVocabDetails) {
      try {
        await page.waitForURL(/\/practice\/details/, { timeout: 15000 });
      } catch {
        await page.waitForURL(/\/practice\/quiz/, { timeout: 15000 });
      }
    } else {
      await page.waitForURL(/\/practice\/quiz/, { timeout: 15000 });
    }
  }

  /**
   * 等待题目生成完成
   */
  static async waitForGenerationComplete(page: Page): Promise<void> {
    // Accept several possible generation loading texts used by the app
    await page.getByText(/正在生成题目|AI 正在为您准备题目|AI 正在整理词条|题库准备中/).waitFor({ state: 'hidden', timeout: 60000 });
    await page.waitForURL(/\/practice\/quiz/);
  }

  /**
   * 模拟答题过程
   */
  static async answerQuestion(page: Page, answer: string): Promise<void> {
    const selectedOption = page.getByRole('button', { name: answer });
    await selectedOption.click();
    
    // 等待答案处理
    await page.waitForTimeout(500);
    
    // 点击下一题或提交
    const nextButton = page.getByRole('button', { name: /下一题|提交答案/ });
    if (await nextButton.isVisible()) {
      await nextButton.click();
    }
  }

  /**
   * Mock API响应
   */
  static async mockApiResponse(page: Page, endpoint: string, response: any): Promise<void> {
    await page.route(`**/api${endpoint}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Mock API错误
   */
  static async mockApiError(page: Page, endpoint: string, status: number = 500): Promise<void> {
    await page.route(`**/api${endpoint}`, async (route) => {
      await route.abort(status as any);
    });
  }

  /**
   * 模拟网络延迟
   */
  static async mockNetworkDelay(page: Page, endpoint: string, delay: number): Promise<void> {
    await page.route(`**/api${endpoint}`, async (route) => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.continue();
    });
  }

  /**
   * 清理本地存储
   * 注意：必须在页面导航到有效URL后才能调用
   */
  static async clearLocalStorage(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        localStorage.clear();
      });
    } catch (error) {
      // 如果页面尚未加载，先导航到根路径再清理
      await page.goto('/');
      await page.evaluate(() => {
        localStorage.clear();
      });
    }
  }

  /**
   * 设置本地存储数据
   */
  static async setLocalStorage(page: Page, key: string, value: any): Promise<void> {
    await page.evaluate(([k, v]) => {
      localStorage.setItem(k, JSON.stringify(v));
    }, [key, value]);
  }

  /**
   * 等待元素出现并返回是否可见
   */
  static async waitForElementVisible(page: Page, selector: string, timeout: number = 10000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 生成随机测试邮箱
   */
  static generateTestEmail(): string {
    const timestamp = Date.now();
    return `test${timestamp}@example.com`;
  }

  /**
   * 生成随机测试密码
   */
  static generateTestPassword(): string {
    return `TestPass123!${Math.random().toString(36).slice(-6)}`;
  }
}

/**
 * 测试数据常量
 */
export const TEST_DATA = {
  VALID_EMAIL: 'test@example.com',
  VALID_PASSWORD: 'TestPass123!',
  INVALID_EMAIL: 'invalid-email',
  INVALID_PASSWORD: '123',
  TEST_WORDS: ['apple', 'banana', 'orange', 'grape', 'watermelon'],
  DIFFICULTY_LEVELS: ['beginner', 'intermediate', 'advanced'] as DifficultyLevel[],
  MOCK_VLM_RESPONSE: {
    words: ['apple', 'banana', 'orange', 'grape', 'watermelon']
  },
  MOCK_GENERATION_RESPONSE: {
    id: 'test-session-id',
    status: 'completed',
    superJson: {
      sections: {
        '选择题': [
          {
            question: 'What is "apple" in Chinese?',
            options: ['苹果', '香蕉', '橙子', '葡萄'],
            correct: 0,
            explanation: 'Apple means 苹果 in Chinese.'
          }
        ],
        '填空题': [
          {
            question: 'The color of _____ is red.',
            answer: 'apple',
            hint: 'A common fruit'
          }
        ],
        '判断题': [
          {
            statement: 'Banana is a yellow fruit.',
            correct: true,
            explanation: 'Bananas are typically yellow when ripe.'
          }
        ]
      }
    }
  }
};