import {
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import styles from './index.module.less';

export function FormPage() {
  const [messageApi, contextHolder] = message.useMessage();

  return (
    <Space orientation="vertical" size={24} className={styles.pageStack}>
      {contextHolder}
      <div>
        <Typography.Title level={2}>表单录入</Typography.Title>
        <Typography.Paragraph type="secondary">
          覆盖 Form、Input、Select、DatePicker、Radio、Checkbox、Switch 等组件。
        </Typography.Paragraph>
      </div>

      <Card title="创建任务">
        <Form
          layout="vertical"
          initialValues={{
            priority: 'normal',
            public: true,
            members: ['frontend'],
          }}
          onFinish={() => {
            messageApi.success('表单提交成功');
          }}
        >
          <Form.Item
            label="任务名称"
            name="title"
            rules={[{ required: true, message: '请输入任务名称' }]}
          >
            <Input placeholder="例如：整理 Antd 组件示例" />
          </Form.Item>

          <Form.Item
            label="所属模块"
            name="module"
            rules={[{ required: true }]}
          >
            <Select
              placeholder="请选择模块"
              options={[
                { label: '页面路由', value: 'router' },
                { label: '表单录入', value: 'form' },
                { label: '数据列表', value: 'table' },
              ]}
            />
          </Form.Item>

          <Form.Item label="截止日期" name="deadline">
            <DatePicker className={styles.formControl} />
          </Form.Item>

          <Form.Item label="优先级" name="priority">
            <Radio.Group
              options={[
                { label: '普通', value: 'normal' },
                { label: '重要', value: 'important' },
                { label: '紧急', value: 'urgent' },
              ]}
            />
          </Form.Item>

          <Form.Item label="参与角色" name="members">
            <Checkbox.Group
              options={[
                { label: '前端', value: 'frontend' },
                { label: '后端', value: 'backend' },
                { label: '测试', value: 'qa' },
              ]}
            />
          </Form.Item>

          <Form.Item label="预估工时">
            <Space.Compact className={styles.formControl}>
              <Form.Item name="hours" noStyle>
                <InputNumber min={1} max={40} className={styles.hoursInput} />
              </Form.Item>
              <Input value="小时" readOnly className={styles.hoursUnit} />
            </Space.Compact>
          </Form.Item>

          <Form.Item label="公开任务" name="public" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                提交
              </Button>
              <Button htmlType="reset">重置</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  );
}
