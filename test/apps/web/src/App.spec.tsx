import { App } from '@/App';

describe('App', () => {
  // 正常场景：App 作为应用入口时应返回路由壳组件，保证根组件没有绕过 Router 层。
  it('renders the router shell', () => {
    const element = App();

    expect(element.type.name).toBe('AppRouter');
  });
});
