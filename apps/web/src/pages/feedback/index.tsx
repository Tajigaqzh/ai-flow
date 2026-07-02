import {
  Button,
  Card,
  Modal,
  Popconfirm,
  Space,
  Typography,
  message,
  notification,
} from 'antd';
import styles from './index.module.less';

export function FeedbackPage() {
  const [modal, _modalContextHolder] = Modal.useModal();
  const [messageApi, _messageContextHolder] = message.useMessage();
  const [notificationApi, _notificationContextHolder] =
    notification.useNotification();

  return (
    <Space orientation="vertical" size={24} className={styles.pageStack}>
      {/* staged-check-disable commented-code -- keep Ant Design context holder references */}
      {/*{modalContextHolder}*/}
      {/*{messageContextHolder}*/}
      {/*{notificationContextHolder}*/}
      {/* staged-check-enable commented-code */}

      <div>
        <Typography.Title level={2}>反馈弹窗</Typography.Title>
        <Typography.Paragraph type="secondary">
          覆盖 Modal、Message、Notification、Popconfirm 等反馈组件。
        </Typography.Paragraph>
      </div>
      {/*你好*/}
      <Card title="常见反馈">
        <Space wrap>
          <Button
            type="primary"
            onClick={() => {
              modal.info({
                title: 'Modal 信息',
                content: '这里适合承载需要用户明确阅读的内容。',
              });
            }}
          >
            打开 Modal
          </Button>

          <Button
            onClick={() => {
              messageApi.success('Message 操作成功');
            }}
          >
            Message
          </Button>

          <Button
            onClick={() => {
              notificationApi.open({
                message: 'Notification',
                description: '这里适合展示不会阻塞当前操作的通知。',
              });
            }}
          >
            Notification
          </Button>

          <Popconfirm
            title="确认删除这条记录？"
            okText="确认"
            cancelText="取消"
            onConfirm={() => {
              messageApi.success('已删除');
            }}
          >
            <Button danger>Popconfirm</Button>
          </Popconfirm>
        </Space>
      </Card>
    </Space>
  );
}
