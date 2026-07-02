import { renderToStaticMarkup } from 'react-dom/server';
import { HomePage } from '@/pages/home';
import { useFlowStore } from '@/store/use-flow-store';

describe('HomePage', () => {
  beforeEach(() => {
    useFlowStore.setState({ currentFlow: 'Draft' });
  });

  // 正常场景：页面首次渲染应展示概览文案、组件分组和 Draft 状态。
  it('renders overview content with the initial flow state', () => {
    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('组件总览');
    expect(html).toContain('基础输入');
    expect(html).toContain('数据展示');
    expect(html).toContain('反馈操作');
    expect(html).toContain('Current flow:');
    expect(html).toContain('Draft');
  });

  // 边界场景：当 store 已经进入 Started 状态时，页面应渲染最新状态而不是默认值。
  it('renders the started flow state from the store', () => {
    useFlowStore.setState({ currentFlow: 'Started' });

    const html = renderToStaticMarkup(<HomePage />);

    expect(html).toContain('Started');
  });
});
