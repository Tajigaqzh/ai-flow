import {
  Badge,
  Button,
  Card,
  Col,
  Flex,
  Row,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import { useFlowStore } from '@/store/use-flow-store';
import styles from './index.module.less';

const componentGroups = [
  {
    title: '基础输入',
    items: ['Button', 'Input', 'Select', 'DatePicker', 'Switch'],
  },
  {
    title: '数据展示',
    items: ['Table', 'Tag', 'Badge', 'Statistic', 'Card'],
  },
  {
    title: '反馈操作',
    items: ['Modal', 'Message', 'Notification', 'Popconfirm'],
  },
];

export function HomePage() {
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const markStarted = useFlowStore((state) => state.markStarted);

  return (
    <Space direction="vertical" size={24} className={styles.pageStack}>
      <Flex justify="space-between" align="flex-start" gap={16} wrap>
        <div>
          <Typography.Title level={2}>组件总览</Typography.Title>
          <Typography.Paragraph type="secondary">
            路由已经拆成独立页面，左侧菜单可切换不同 Ant Design 示例。
          </Typography.Paragraph>
        </div>
        <Space>
          <Tag color="blue">React Router</Tag>
          <Tag color="green">Ant Design</Tag>
          <Badge
            status={currentFlow === 'Started' ? 'processing' : 'default'}
            text={currentFlow}
          />
        </Space>
      </Flex>

      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="已拆分页面" value={4} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="路由入口" value={4} suffix="个" />
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card>
            <Statistic title="当前状态" value={currentFlow} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {componentGroups.map((group) => (
          <Col xs={24} lg={8} key={group.title}>
            <Card title={group.title}>
              <Space wrap>
                {group.items.map((item) => (
                  <Tag key={item}>{item}</Tag>
                ))}
              </Space>
            </Card>
          </Col>
        ))}
      </Row>

      <Card title="Zustand 状态示例">
        <Space direction="vertical">
          <Typography.Text>Current flow: {currentFlow}</Typography.Text>
          <Button type="primary" onClick={markStarted}>
            Get Started
          </Button>
        </Space>
      </Card>
    </Space>
  );
}
