import { expect, test } from '@playwright/test';

test('chat page opens from the menu without sending a request', async ({
  page,
}) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'AI 聊天' }).click();

  await expect(page.getByRole('heading', { name: 'AI 聊天' })).toBeVisible();
  await expect(page.getByText('你好，我是项目内置 AI 助手。')).toBeVisible();
  await expect(
    page.getByPlaceholder('输入你想让 AI 帮你处理的问题'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /发\s*送/ })).toBeDisabled();
});
