import { Button, Card, Progress, Space, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import styles from './index.module.less';

type TaskRow = {
  key: string;
  name: string;
  owner: string;
  status: 'todo' | 'doing' | 'done';
  progress: number;
};

const rows: TaskRow[] = [
  {
    key: '1',
    name: '配置路由表',
    owner: 'Alice',
    status: 'done',
    progress: 100,
  },
  { key: '2', name: '拆分 pages', owner: 'Bob', status: 'doing', progress: 68 },
  {
    key: '3',
    name: '补充组件示例',
    owner: 'Cindy',
    status: 'todo',
    progress: 20,
  },
  {
    key: '4',
    name: '整理学习笔记',
    owner: 'David',
    status: 'todo',
    progress: 10,
  },
];

const statusMap = {
  todo: { color: 'default', label: '待处理' },
  doing: { color: 'processing', label: '进行中' },
  done: { color: 'success', label: '已完成' },
} satisfies Record<TaskRow['status'], { color: string; label: string }>;

const columns: TableProps<TaskRow>['columns'] = [
  {
    title: '任务',
    dataIndex: 'name',
    key: 'name',
  },
  {
    title: '负责人',
    dataIndex: 'owner',
    key: 'owner',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: TaskRow['status']) => (
      <Tag color={statusMap[status].color}>{statusMap[status].label}</Tag>
    ),
  },
  {
    title: '进度',
    dataIndex: 'progress',
    key: 'progress',
    render: (progress: number) => <Progress percent={progress} size="small" />,
  },
  {
    title: '操作',
    key: 'action',
    render: () => (
      <Space>
        <Button type="link">编辑</Button>
        <Button type="link" danger>
          删除
        </Button>
      </Space>
    ),
  },
];

export function TablePage() {
  return (
    <Space direction="vertical" size={24} className={styles.pageStack}>
      <div>
        <Typography.Title level={2}>表格列表</Typography.Title>
        <Typography.Paragraph type="secondary">
          覆盖 Table、Tag、Progress、Button、分页和行选择。
        </Typography.Paragraph>
      </div>

      {/*你好*/}
      <Card title="任务清单">
        <Table
          columns={columns}
          dataSource={rows}
          rowSelection={{}}
          pagination={{ pageSize: 3 }}
          scroll={{ x: 760 }}
        />
      </Card>
    </Space>
  );
}
