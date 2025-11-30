import { test, expect } from '@playwright/test';

test.describe('访客落地页流程', () => {
  test('切换注册标签并以游客模式进入控制台', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'AI 动态词汇练习' })).toBeVisible();

    await page.getByRole('button', { name: '注册' }).click();
    await expect(page.getByRole('button', { name: '注册并登录' })).toBeVisible();

    await page.getByRole('button', { name: '先逛逛（游客模式）' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: '上传词表 → 选择难度 → 题流练习 → AI 分析' })).toBeVisible();
    await expect(page.getByText('完成练习后可在报告页注册/登录')).toBeVisible();
  });
});
