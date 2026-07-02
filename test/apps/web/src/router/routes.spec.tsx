import { appRoutes } from '@/router/routes';

describe('appRoutes', () => {
  // 正常场景：路由表应包含所有业务页面和新增 AI 聊天页面入口。
  it('contains the expected application routes', () => {
    expect(appRoutes.map((route) => route.path)).toEqual([
      'overview',
      'form',
      'table',
      'feedback',
      'chat',
    ]);
  });

  // 边界场景：每个路由都必须提供菜单展示文案和 React element，避免布局菜单出现空项。
  it('provides labels and elements for every route', () => {
    for (const route of appRoutes) {
      expect(route.label).toEqual(expect.any(String));
      expect(route.label).not.toHaveLength(0);
      expect(route.element).toBeTruthy();
    }
  });
});
