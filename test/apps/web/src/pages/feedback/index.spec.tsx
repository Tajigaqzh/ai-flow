import { renderToStaticMarkup } from 'react-dom/server';
import { FeedbackPage } from '@/pages/feedback';

describe('FeedbackPage', () => {
  // 正常场景：页面应渲染反馈组件总览文案和常见反馈操作入口。
  it('renders feedback overview and action buttons', () => {
    const html = renderToStaticMarkup(<FeedbackPage />);

    expect(html).toContain('反馈弹窗');
    expect(html).toContain(
      '覆盖 Modal、Message、Notification、Popconfirm 等反馈组件。',
    );
    expect(html).toContain('常见反馈');
    expect(html).toContain('打开 Modal');
    expect(html).toContain('Message');
    expect(html).toContain('Notification');
    expect(html).toContain('Popconfirm');
  });

  // 边界场景：危险操作入口必须通过 Popconfirm 包裹的按钮暴露，确认浮层内容由交互时挂载。
  it('renders the guarded delete action entry', () => {
    const html = renderToStaticMarkup(<FeedbackPage />);

    expect(html).toContain('Popconfirm');
    expect(html).toContain('ant-btn-dangerous');
  });
});
