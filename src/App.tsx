import {
  App as AntApp,
  ConfigProvider,
  Input,
  Layout,
  Menu,
  Space,
  theme as antdTheme,
  Typography,
} from 'antd'
import zhCN from 'antd/locale/zh_CN'
import {
  ApiOutlined,
  CloudOutlined,
  FileSearchOutlined,
  FolderOpenOutlined,
  HomeOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { setStoredToken } from './api/client'
import { DialogueSummonTest } from './pages/knowledgeRecall/DialogueSummonTest'
import { NaturalLanguageRecall } from './pages/knowledgeRecall/NaturalLanguageRecall'
import { StopwordsConfig } from './pages/knowledgeRecall/StopwordsConfig'
import { Home } from './pages/Home'
import { Layers } from './pages/Layers'
import { CompileTask } from './pages/llmTasks/CompileTask'
import { LintReport } from './pages/llmTasks/LintReport'
import { PolishTextPage } from './pages/llmTasks/PolishTextPage'
import { ModelSettings } from './pages/ModelSettings'

const { Header, Sider, Content } = Layout
const { Text } = Typography

function Shell() {
  const loc = useLocation()
  const selected = useMemo(() => {
    if (loc.pathname.startsWith('/layers')) return ['/layers']
    if (loc.pathname.startsWith('/knowledge-recall/nl')) return ['/knowledge-recall/nl']
    if (loc.pathname.startsWith('/knowledge-recall/dialogue-test')) return ['/knowledge-recall/dialogue-test']
    if (loc.pathname.startsWith('/knowledge-recall/stopwords')) return ['/knowledge-recall/stopwords']
    if (loc.pathname.startsWith('/tasks/lint')) return ['/tasks/lint']
    if (loc.pathname.startsWith('/tasks/compile') || loc.pathname === '/tasks') return ['/tasks/compile']
    if (loc.pathname.startsWith('/settings/llm')) return ['/settings/llm']
    return ['/']
  }, [loc.pathname])

  const [tokenDraft, setTokenDraft] = useState(() => localStorage.getItem('pathy_api_token') ?? '')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={0} theme="light">
        <div
          style={{
            padding: '16px 12px',
            borderBottom: '1px solid #f0f0f0',
            textAlign: 'center',
          }}
        >
          <Text strong>Pathy-knowledge</Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={selected}
          defaultOpenKeys={['llm-tasks', 'knowledge-recall']}
          items={[
            { key: '/', icon: <HomeOutlined />, label: <Link to="/">概览</Link> },
            { key: '/layers', icon: <FolderOpenOutlined />, label: <Link to="/layers">三层存储</Link> },
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
              key: '/settings/llm',
              icon: <SettingOutlined />,
              label: <Link to="/settings/llm">模型配置</Link>,
            },
          ]}
        />
        <div style={{ padding: 12, borderTop: '1px solid #f0f0f0' }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
            <CloudOutlined /> 可选 Bearer
          </Text>
          <Input.Password
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            onBlur={() => setStoredToken(tokenDraft.trim() || null)}
            placeholder="与 API_KEY 一致时填写"
            size="small"
          />
        </div>
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            alignItems: 'center',
            paddingInline: 24,
          }}
        >
          <Space>
            <Text type="secondary">Wiki 知识库控制台</Text>
          </Space>
        </Header>
        <Content style={{ padding: 24, background: '#f5f5f5' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/layers" element={<Layers />} />
              <Route path="/tasks" element={<Navigate to="/tasks/compile" replace />} />
              <Route path="/tasks/compile" element={<CompileTask />} />
              <Route path="/tasks/lint" element={<LintReport />} />
              <Route path="/tasks/polish" element={<PolishTextPage />} />
              <Route path="/knowledge-recall/nl" element={<NaturalLanguageRecall />} />
              <Route path="/knowledge-recall/dialogue-test" element={<DialogueSummonTest />} />
              <Route path="/knowledge-recall/stopwords" element={<StopwordsConfig />} />
              <Route path="/settings/llm" element={<ModelSettings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}

export default function App() {
  return (
    <ConfigProvider locale={zhCN} theme={{ algorithm: antdTheme.defaultAlgorithm }}>
      <AntApp>
        <Shell />
      </AntApp>
    </ConfigProvider>
  )
}
