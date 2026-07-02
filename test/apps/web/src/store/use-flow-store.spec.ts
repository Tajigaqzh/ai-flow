import { useFlowStore } from '@/store/use-flow-store';

describe('useFlowStore', () => {
  beforeEach(() => {
    useFlowStore.setState({ currentFlow: 'Draft' });
  });

  // 正常场景：调用 markStarted 后应把流程状态从默认草稿态推进到 Started。
  it('marks the current flow as started', () => {
    useFlowStore.getState().markStarted();

    expect(useFlowStore.getState().currentFlow).toBe('Started');
  });
});
