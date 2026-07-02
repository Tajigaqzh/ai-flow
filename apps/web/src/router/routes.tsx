import type { ReactElement } from 'react';
import { FeedbackPage, FormPage, HomePage, TablePage } from '@/pages';

export type AppRoute = {
  path: string;
  label: string;
  element: ReactElement;
};

/**
 * 路由表
 */
export const appRoutes: AppRoute[] = [
  {
    path: 'overview',
    label: '组件总览',
    element: <HomePage />,
  },
  {
    path: 'form',
    label: '表单录入',
    element: <FormPage />,
  },
  {
    path: 'table',
    label: '表格列表',
    element: <TablePage />,
  },
  {
    path: 'feedback',
    label: '反馈弹窗',
    element: <FeedbackPage />,
  },
];
