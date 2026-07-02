import { create } from 'zustand';

type FlowState = {
  currentFlow: string;
  markStarted: () => void;
};
/**
 * 定义store
 */
export const useFlowStore = create<FlowState>((set) => ({
  currentFlow: 'Draft',
  markStarted: () => set({ currentFlow: 'Started' }),
}));
