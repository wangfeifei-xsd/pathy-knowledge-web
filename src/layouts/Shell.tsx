import { App as AntApp, ConfigProvider, Layout, Menu, Space, theme as antdTheme, Typography } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  ApiOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

const { Header, Sider, Content } = Layout
const { Text } = Typography

export function Shell() {
  const loc = useLocation()
  const selected = useMemo(() => {
    if (loc.pathname.startsWith('/layers')) return ['/layers']
    if (loc.pathname.startsWith('/storage/structure')) return ['/storage/structure']
    if (loc.pathname.startsWith('/knowledge-recall/nl')) return ['/knowledge-recall/nl']
    if (loc.pathname.startsWith('/knowledge-recall/dialogue-test')) return ['/knowledge-recall/dialogue-test']
    if (loc.pathname.startsWith('/knowledge-recall/stopwords')) return ['/knowledge-recall/stopwords']
    if (loc.pathname.startsWith('/tasks/lint')) return ['/tasks/lint']
    if (loc.pathname.startsWith('/tasks/compile') || loc.pathname === '/tasks') return ['/tasks/compile']
    if (loc.pathname.startsWith('/settings/llm')) return ['/settings/llm']
    if (loc.pathname.startsWith('/settings/embedding')) return ['/settings/embedding']
    if (loc.pathname.startsWith('/settings/rerank')) return ['/settings/rerank']
    return ['/']
  }, [loc.pathname])

  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: antdTheme.defaultAlgorithm }}>
      <AntApp style={{ height: '100%' }}>
        <Layout className="shell-app" style={{ height: '100vh', overflow: 'hidden', display: 'flex' }}>
          <Sider
            breakpoint="lg"
            collapsedWidth={0}
            theme="light"
            width={220}
            style={{ height: '100vh', overflow: 'hidden', flexShrink: 0 }}
          >
            <div
              style={{
                flexShrink: 0,
                height: 72,
                boxSizing: 'border-box',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingInline: 12,
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <Text strong className="shell-brand-title">
                wiki-knowledge
              </Text>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
              <Menu
                mode="inline"
                selectedKeys={selected}
                defaultOpenKeys={['storage', 'llm-tasks', 'knowledge-recall', 'model-settings']}
                style={{ borderRight: 0 }}
                items={[
                    { key: '/', icon: <HomeOutlined />, label: <Link to="/">概览</Link> },
                    {
                      key: 'storage',
                      icon: <DatabaseOutlined />,
                      label: '存储',
                      children: [
                        { key: '/layers', label: <Link to="/layers">三层存储</Link> },
                        {
                          key: '/storage/structure',
                          label: <Link to="/storage/structure">存储结构</Link>,
                        },
                      ],
                    },
                    {
                      key: 'llm-tasks',
                      icon: <ApiOutlined />,
                      label: 'LLM 任务',
                      children: [
                        { key: '/tasks/compile', label: <Link to="/tasks/compile">编译任务</Link> },
                        { key: '/tasks/lint', label: <Link to="/tasks/lint">一致性报告</Link> },
                      ],
                    },
                    {
                      key: 'knowledge-recall',
                      icon: <FileSearchOutlined />,
                      label: '知识召回',
                      children: [
                        {
                          key: '/knowledge-recall/nl',
                          label: <Link to="/knowledge-recall/nl">召回知识</Link>,
                        },
                        {
                          key: '/knowledge-recall/dialogue-test',
                          label: <Link to="/knowledge-recall/dialogue-test">对话召回测试</Link>,
                        },
                        {
                          key: '/knowledge-recall/stopwords',
                          label: <Link to="/knowledge-recall/stopwords">停用词配置</Link>,
                        },
                      ],
                    },
                    {
                      key: 'model-settings',
                      icon: <SettingOutlined />,
                      label: '模型配置',
                      children: [
                        { key: '/settings/llm', label: <Link to="/settings/llm">LLM模型配置</Link> },
                        {
                          key: '/settings/embedding',
                          label: <Link to="/settings/embedding">Embedding模型配置</Link>,
                        },
                        {
                          key: '/settings/rerank',
                          label: <Link to="/settings/rerank">Rerank模型配置</Link>,
                        },
                      ],
                    },
                  ]}
              />
            </div>
          </Sider>
          <Layout
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <Header
              style={{
                flexShrink: 0,
                height: 72,
                boxSizing: 'border-box',
                paddingBlock: 0,
                paddingInline: 24,
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                background: '#fff',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <Space>
                <Text type="secondary">Wiki 知识库控制台</Text>
              </Space>
            </Header>
            <Content
              style={{
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                padding: 24,
                background: '#f5f5f5',
              }}
            >
              <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                <Outlet />
              </div>
            </Content>
          </Layout>
        </Layout>
      </AntApp>
    </ConfigProvider>
  )
}
