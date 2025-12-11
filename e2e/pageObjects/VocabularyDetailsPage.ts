import { type Page, Locator } from '@playwright/test';
import { TestHelpers } from '../helpers/testHelpers';

export class VocabularyDetailsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly startPracticeButton: Locator;
  readonly progressText: Locator;
  readonly vocabList: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /逐词检查释义与例句|词汇详情/ });
    this.startPracticeButton = page.getByRole('button', { name: /开始练习|继续练习/ });
    this.progressText = page.getByText(/已就绪/);
    this.vocabList = page.locator('.vocab-entry');
  }

  async waitForPageLoad(): Promise<void> {
    await TestHelpers.waitForPageLoad(this.page, this.heading);
  }

  async clickStartPractice(): Promise<void> {
    await this.startPracticeButton.click();
    await this.page.waitForURL(/\/practice\/quiz/);
  }

  async isDetailReady(): Promise<boolean> {
    try {
      return await this.vocabList.count() > 0;
    } catch {
      return false;
    }
  }

  async getVocabEntriesCount(): Promise<number> {
    return await this.vocabList.count();
  }
}
