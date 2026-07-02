import { Button, Result, Space } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import styles from './index.module.less';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <Result
        status="404"
        title="404"
        subTitle="页面不存在或已经被移动"
        extra={
          <Space wrap>
            <Button type="primary">
              <Link to="/overview">返回首页</Link>
            </Button>
            <Button onClick={() => navigate(-1)}>返回上一页</Button>
          </Space>
        }
      />
    </div>
  );
}
