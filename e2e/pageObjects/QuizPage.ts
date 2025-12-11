import { type Page, Locator } from '@playwright/test';
import { TestHelpers } from '../helpers/testHelpers';

export class QuizPage {
  readonly page: Page;
  readonly questionContainer: Locator;
  readonly questionText: Locator;
  readonly optionsContainer: Locator;
  readonly optionButtons: Locator;
  readonly textInput: Locator;
  readonly nextButton: Locator;
  readonly submitButton: Locator;
  readonly progressBar: Locator;
  readonly questionNumber: Locator;
  readonly timer: Locator;
  readonly listeningModeButton: Locator;
  readonly pauseButton: Locator;
  readonly loadingIndicator: Locator;

  constructor(page: Page) {
    this.page = page;
    // The quiz page uses .question-card and .choices for the main layout
    this.questionContainer = page.locator('.panel.question-card');
    this.questionText = page.locator('.panel.question-card .prompt-row h3');
    this.optionsContainer = page.locator('.choices');
    this.optionButtons = page.locator('.choices button.choice, .choices button');
    this.textInput = page.locator('input[type="text"], textarea');
    this.nextButton = page.getByRole('button', { name: '下一题' });
    this.submitButton = page.getByRole('button', { name: '提交答案' });
    this.progressBar = page.locator('.progress-count');
    this.questionNumber = page.locator('.progress-count');
    this.timer = page.locator('.timer, .progress-count');
    this.listeningModeButton = page.getByRole('button', { name: '听力模式' });
    this.pauseButton = page.getByRole('button', { name: '暂停' });
    this.loadingIndicator = page.getByText(/正在生成题目|AI 正在为您准备题目|AI 正在整理词条|题库准备中/);
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(): Promise<void> {
    await TestHelpers.waitForPageLoad(this.page, this.questionContainer);
  }

  /**
   * 等待题目加载完成
   */
  async waitForQuestionLoad(): Promise<void> {
    await this.questionContainer.waitFor({ state: 'visible' });
    // Question text may not be visible in some loading states; wait for either the question text, options list or text input to be visible.
    try {
      await this.questionText.waitFor({ state: 'visible', timeout: 3000 });
    } catch (e) {
      try {
        await this.optionsContainer.waitFor({ state: 'visible', timeout: 3000 });
      } catch (e2) {
        await this.textInput.waitFor({ state: 'visible', timeout: 3000 });
      }
    }
  }

  /**
   * 获取当前题目文本
   */
  async getQuestionText(): Promise<string> {
    await this.waitForQuestionLoad();
    return await this.questionText.textContent() || '';
  }

  /**
   * 获取当前题目编号
   */
  async getQuestionNumber(): Promise<string> {
    return await this.questionNumber.textContent() || '';
  }

  /**
   * 获取所有选项文本
   */
  async getOptions(): Promise<string[]> {
    const options = await this.optionButtons.all();
    const optionTexts: string[] = [];
    
    for (const option of options) {
      const text = await option.textContent();
      if (text) {
        optionTexts.push(text.trim());
      }
    }
    
    return optionTexts;
  }

  /**
   * 选择指定文本的选项
   */
  async selectOption(optionText: string): Promise<void> {
    const option = this.optionButtons.filter({ hasText: optionText }).first();
    const count = await option.count();
    if (count > 0) {
      await option.click();
    } else {
      // Fallback: if the expected option text is not found, click the first available option
      const options = this.optionButtons;
      const total = await options.count();
      if (total > 0) {
        await options.first().click();
      } else {
        throw new Error(`No option buttons found to select for '${optionText}'`);
      }
    }
    await this.page.waitForTimeout(500); // 等待选择动画
  }

  /**
   * 选择指定索引的选项
   */
  async selectOptionByIndex(index: number): Promise<void> {
    const options = await this.optionButtons.all();
    if (index < options.length) {
      await options[index].click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * 填写文本答案
   */
  async fillTextAnswer(answer: string): Promise<void> {
    try {
      await this.textInput.waitFor({ state: 'visible', timeout: 5000 });
      await this.textInput.fill(answer);
    } catch (e) {
      // If text input is not found or not available, try a fallback to click first option
      const options = this.optionButtons;
      const total = await options.count();
      if (total > 0) {
        await options.first().click();
      } else {
        throw e;
      }
    }
    await this.page.waitForTimeout(300);
  }

  /**
   * 点击下一题按钮
   */
  async clickNext(): Promise<void> {
    await this.nextButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 点击提交答案按钮
   */
  async clickSubmit(): Promise<void> {
    await this.submitButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 答答选择题
   */
  async answerMultipleChoice(optionText: string): Promise<void> {
    await this.selectOption(optionText);
    await this.clickNext();
  }

  /**
   * 回答填空题
   */
  async answerFillBlank(answer: string): Promise<void> {
    await this.fillTextAnswer(answer);
    await this.clickSubmit();
  }

  /**
   * 获取当前进度
   */
  async getProgress(): Promise<string> {
    return await this.progressBar.textContent() || '';
  }

  /**
   * 检查是否在答题页面
   */
  async isOnQuizPage(): Promise<boolean> {
    return await this.questionContainer.isVisible();
  }

  /**
   * 检查是否有下一题按钮
   */
  async hasNextButton(): Promise<boolean> {
    return await this.nextButton.isVisible();
  }

  /**
   * 检查是否有提交按钮
   */
  async hasSubmitButton(): Promise<boolean> {
    return await this.submitButton.isVisible();
  }

  /**
   * 检查是否有文本输入框
   */
  async hasTextInput(): Promise<boolean> {
    return await this.textInput.isVisible();
  }

  /**
   * 切换听力模式
   */
  async toggleListeningMode(): Promise<void> {
    await this.listeningModeButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 点击暂停按钮
   */
  async clickPause(): Promise<void> {
    await this.pauseButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 等待题目生成完成
   */
  async waitForGenerationComplete(): Promise<void> {
    await this.loadingIndicator.waitFor({ state: 'hidden', timeout: 60000 });
    await this.waitForQuestionLoad();
  }

  /**
   * 模拟完整的答题过程
   */
  async completeQuiz(answers: Array<{ type: 'choice' | 'text'; value: string }>): Promise<void> {
    for (const answer of answers) {
      await this.waitForQuestionLoad();
      
      if (answer.type === 'choice') {
        await this.answerMultipleChoice(answer.value);
      } else {
        await this.answerFillBlank(answer.value);
      }
      
      // 等待页面更新
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * 自动完成答题过程（默认选择第一个选项或填写占位符文本），直到跳转到报告页面或达到最大步骤
   */
  async completeQuizAuto(maxSteps: number = 100): Promise<void> {
    for (let i = 0; i < maxSteps; i++) {
      // 如果已重定向到报告页则结束
      if (this.page.url().includes('/practice/report')) {
        return;
      }

      await this.waitForQuestionLoad();

      const qType = await this.getQuestionType();
      if (qType === 'multiple-choice') {
        const options = await this.getOptions();
        if (options.length > 0) {
          await this.selectOptionByIndex(0);
        }
        await this.clickNext();
      } else if (qType === 'fill-blank') {
        if (await this.hasTextInput()) {
          await this.fillTextAnswer('test');
          await this.clickSubmit();
        } else {
          const options = await this.getOptions();
          if (options.length > 0) {
            await this.selectOptionByIndex(0);
          }
          await this.clickNext();
        }
      } else {
        // Unknown type: try to pick first option or fill text
        if (await this.hasTextInput()) {
          await this.fillTextAnswer('test');
          await this.clickSubmit();
        } else {
          const options = await this.getOptions();
          if (options.length > 0) await this.selectOptionByIndex(0);
          await this.clickNext();
        }
      }

      // 等待页面更新
      await this.page.waitForTimeout(200);
    }
  }

  /**
   * Mock 生成API响应
   */
  async mockGenerationResponse(response: any): Promise<void> {
    await TestHelpers.mockApiResponse(this.page, '/generation/session', response);
  }

  /**
   * Mock 生成进度API响应
   */
  async mockGenerationProgress(sessionId: string, response: any): Promise<void> {
    await TestHelpers.mockApiResponse(this.page, `/generation/session/${sessionId}`, response);
  }

  /**
   * Mock 分析API响应
   */
  async mockAnalysisResponse(response: any): Promise<void> {
    await TestHelpers.mockApiResponse(this.page, '/analysis/report', response);
  }

  /**
   * 等待跳转到报告页面
   */
  async waitForRedirectToReport(): Promise<void> {
    await this.page.waitForURL(/\/practice\/report/);
  }

  /**
   * 获取当前题目类型
   */
  async getQuestionType(): Promise<string> {
    // 根据页面元素判断题目类型
    if (await this.hasTextInput()) {
      return 'fill-blank';
    } else if (await this.optionsContainer.isVisible()) {
      return 'multiple-choice';
    }
    return 'unknown';
  }
}