import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { NotFoundPage } from '@/pages/not-found';

describe('NotFoundPage', () => {
  // 异常场景：未知路由页面应渲染 404 状态和页面不存在提示。
  it('renders the not found status and message', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(html).toContain('404');
    expect(html).toContain('页面不存在或已经被移动');
  });

  // 边界场景：未知路由必须同时提供返回首页和返回上一页，覆盖可恢复导航路径。
  it('renders recovery navigation actions', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>,
    );

    expect(html).toContain('返回首页');
    expect(html).toContain('href="/overview"');
    expect(html).toContain('返回上一页');
  });
});
