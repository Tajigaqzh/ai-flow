import { expect, test } from '@playwright/test';

test('home page loads and starts a flow', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Ant Design 常用组件')).toBeVisible();
  await expect(page.getByText('组件总览')).toBeVisible();

  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(page.getByText('Current flow: Started')).toBeVisible();
});
