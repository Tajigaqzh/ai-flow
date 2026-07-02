import { ConfigProvider, Layout, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { appRoutes } from '@/router/routes';

const { Header, Content, Sider } = Layout;

const menuItems: MenuProps['items'] = appRoutes.map((route) => ({
  key: `/${route.path}`,
  label: <Link to={`/${route.path}`}>{route.label}</Link>,
}));

export function AppLayout() {
  const location = useLocation();
  const selectedPath = appRoutes.find(
    (route) =>
      location.pathname === `/${route.path}` ||
      location.pathname.startsWith(`/${route.path}/`),
  )?.path;

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 6,
        },
      }}
    >
      <Layout className="app-shell">
        <Sider
          className="app-sider"
          breakpoint="lg"
          collapsedWidth={0}
          theme="light"
          width={220}
        >
          <div className="app-brand">
            <Typography.Title level={4}>Antd Lab</Typography.Title>
            <Typography.Text type="secondary">常用组件练习</Typography.Text>
          </div>
          <Menu
            mode="inline"
            selectedKeys={selectedPath ? [`/${selectedPath}`] : []}
            items={menuItems}
            className="app-menu"
          />
        </Sider>
        <Layout className="app-main">
          <Header className="app-header">
            <Typography.Title level={3}>Ant Design 常用组件</Typography.Title>
          </Header>
          <Content className="app-content">
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
}
