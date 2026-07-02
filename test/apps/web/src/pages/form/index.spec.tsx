import { renderToStaticMarkup } from 'react-dom/server';
import { FormPage } from '@/pages/form';

describe('FormPage', () => {
  // 正常场景：页面应渲染表单标题、说明文案和主要输入控件标签。
  it('renders form overview and required task fields', () => {
    const html = renderToStaticMarkup(<FormPage />);

    expect(html).toContain('表单录入');
    expect(html).toContain('创建任务');
    expect(html).toContain('任务名称');
    expect(html).toContain('所属模块');
    expect(html).toContain('截止日期');
    expect(html).toContain('预估工时');
  });

  // 正常场景：页面应渲染 2-3 组代表性控件状态，覆盖模块占位、优先级和参与角色。
  it('renders representative module placeholder, priority and member options', () => {
    const html = renderToStaticMarkup(<FormPage />);

    expect(html).toContain('请选择模块');
    expect(html).toContain('普通');
    expect(html).toContain('重要');
    expect(html).toContain('紧急');
    expect(html).toContain('前端');
    expect(html).toContain('后端');
    expect(html).toContain('测试');
  });

  // 边界场景：表单必须保留提交和重置入口，覆盖提交成功与用户撤销填写两条路径。
  it('renders submit and reset actions', () => {
    const html = renderToStaticMarkup(<FormPage />);

    expect(html).toMatch(/提\s*交/);
    expect(html).toMatch(/重\s*置/);
  });
});
