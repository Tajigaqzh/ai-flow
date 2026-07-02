import { useFlowStore } from '@/store/use-flow-store';

describe('useFlowStore', () => {
  beforeEach(() => {
    useFlowStore.setState({ currentFlow: 'Draft' });
  });

  it('marks the current flow as started', () => {
    useFlowStore.getState().markStarted();

    expect(useFlowStore.getState().currentFlow).toBe('Started');
  });
});
