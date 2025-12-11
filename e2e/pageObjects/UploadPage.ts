import { type Page, Locator } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { TestHelpers } from '../helpers/testHelpers';

export class UploadPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly fileInput: Locator;
  readonly uploadArea: Locator;
  readonly uploadButton: Locator;
  readonly clearButton: Locator;
  readonly processingIndicator: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly imagePreview: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: '上传单词表图片' });
    this.fileInput = page.locator('input[type="file"]');
    this.uploadArea = page.locator('.dropzone');
    this.uploadButton = page.getByRole('button', { name: '继续' });
    this.clearButton = page.getByRole('button', { name: '清空' });
    this.processingIndicator = page.getByText(/AI 正在阅读.*张图片/);
    this.errorMessage = page.locator('.form-error, .form-errors .form-error');
    this.successMessage = page.locator('.success, [data-testid="success-message"]');
    this.imagePreview = page.locator('.image-preview');
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(): Promise<void> {
    await TestHelpers.waitForPageLoad(this.page, this.heading);
  }

  /**
   * 检查是否在上传页面
   */
  async isOnUploadPage(): Promise<boolean> {
    return await this.heading.isVisible();
  }

  /**
   * 上传单个文件
   */
  async uploadFile(filePath: string): Promise<void> {
    // Resolve file path robustly from different test CWD environments
    let resolvedPath = filePath;
    if (!path.isAbsolute(filePath)) {
      // Try project root relative path
      const fromCwd = path.resolve(process.cwd(), filePath);
      if (fs.existsSync(fromCwd)) {
        resolvedPath = fromCwd;
      } else {
        // Try relative to e2e folder
        const fromE2E = path.resolve(__dirname, '..', filePath);
        if (fs.existsSync(fromE2E)) {
          resolvedPath = fromE2E;
        } else {
          // As a last resort, try relative to two levels up (repo root) with e2e prefix
          const alt = path.resolve(process.cwd(), 'e2e', filePath.replace(/^e2e\//, ''));
          if (fs.existsSync(alt)) {
            resolvedPath = alt;
          }
        }
      }
    }

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`File not found: ${filePath} (resolved to ${resolvedPath})`);
    }

    await this.fileInput.setInputFiles(resolvedPath);
    await this.page.waitForTimeout(1000); // 等待文件处理
  }

  /**
   * 上传多个文件
   */
  async uploadFiles(filePaths: string[]): Promise<void> {
    await this.fileInput.setInputFiles(filePaths);
    await this.page.waitForTimeout(1000); // 等待文件处理
  }

  /**
   * 拖拽文件到上传区域
   */
  async dragAndDropFile(filePath: string): Promise<void> {
    // 简化的拖拽实现，直接使用文件上传
    await this.uploadFile(filePath);
  }

  /**
   * 点击开始识别按钮
   */
  async clickStartRecognition(): Promise<void> {
    await this.uploadButton.click();
    await this.processingIndicator.waitFor({ state: 'visible' });
  }

  /**
   * 点击清空按钮
   */
  async clickClear(): Promise<void> {
    await this.clearButton.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * 等待识别完成
   */
  async waitForRecognitionComplete(): Promise<void> {
    await this.processingIndicator.waitFor({ state: 'hidden', timeout: 30000 });
  }

  /**
   * 等待跳转到确认页面
   */
  async waitForRedirectToConfirm(): Promise<void> {
    await this.page.waitForURL(/\/practice\/confirm/);
  }

  /**
   * 检查是否有错误消息
   */
  async hasError(): Promise<boolean> {
    return await this.errorMessage.isVisible();
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
   * 检查是否有成功消息
   */
  async hasSuccess(): Promise<boolean> {
    return await this.successMessage.isVisible();
  }

  /**
   * 获取成功消息文本
   */
  async getSuccessMessage(): Promise<string | null> {
    if (await this.successMessage.isVisible()) {
      return await this.successMessage.textContent();
    }
    return null;
  }

  /**
   * 获取已上传的图片数量
   */
  async getUploadedImageCount(): Promise<number> {
    return await this.imagePreview.count();
  }

  /**
   * 检查上传按钮是否可用
   */
  async isUploadButtonEnabled(): Promise<boolean> {
    return await this.uploadButton.isEnabled();
  }

  /**
   * 检查清空按钮是否可见
   */
  async isClearButtonVisible(): Promise<boolean> {
    return await this.clearButton.isVisible();
  }

  /**
   * 模拟完整的上传流程
   */
  async completeUploadProcess(filePath: string): Promise<void> {
    await this.uploadFile(filePath);
    await this.clickStartRecognition();
    await this.waitForRecognitionComplete();
    await this.waitForRedirectToConfirm();
  }

  /**
   * Mock VLM API响应
   */
  async mockVLMResponse(response: { words: string[] } | any): Promise<void> {
    const data = 'words' in response ? response : { words: response };
    await TestHelpers.mockApiResponse(this.page, '/vlm/extract', data);
  }

  /**
   * Mock VLM API错误
   */
  async mockVLMError(status: number = 500): Promise<void> {
    await TestHelpers.mockApiError(this.page, '/vlm/extract', status);
  }

  /**
   * Mock 网络延迟
   */
  async mockNetworkDelay(delay: number): Promise<void> {
    await TestHelpers.mockNetworkDelay(this.page, '/vlm/extract', delay);
  }
}