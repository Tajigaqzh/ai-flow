import { renderToStaticMarkup } from 'react-dom/server';
import { TablePage } from '@/pages/table';

describe('TablePage', () => {
  // 正常场景：页面应渲染表格标题、说明文案和主要列头。
  it('renders table overview and column headers', () => {
    const html = renderToStaticMarkup(<TablePage />);

    expect(html).toContain('表格列表');
    expect(html).toContain('任务清单');
    expect(html).toContain('任务');
    expect(html).toContain('负责人');
    expect(html).toContain('状态');
    expect(html).toContain('进度');
    expect(html).toContain('操作');
  });

  // 正常场景：表格应渲染 2-3 条代表性任务数据，覆盖不同负责人和任务名称。
  it('renders representative task rows', () => {
    const html = renderToStaticMarkup(<TablePage />);

    expect(html).toContain('配置路由表');
    expect(html).toContain('Alice');
    expect(html).toContain('拆分 pages');
    expect(html).toContain('Bob');
    expect(html).toContain('补充组件示例');
    expect(html).toContain('Cindy');
  });

  // 边界场景：表格应渲染全部状态标签，覆盖 todo、doing、done 三种状态映射。
  it('renders all task status labels', () => {
    const html = renderToStaticMarkup(<TablePage />);

    expect(html).toContain('已完成');
    expect(html).toContain('进行中');
    expect(html).toContain('待处理');
  });
});
