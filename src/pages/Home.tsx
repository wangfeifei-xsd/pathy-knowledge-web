import { App, Button, Card, Descriptions, Space, Tooltip, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api, apiErrorDetail } from '../api/client'
import type { BasicModelSettingsResponse, ConfigSummaryResponse, LLMSettingsResponse } from '../api/types'
import './Home.css'

/** 概览页：路径来自 /config；模型与 URL 与侧栏各设置页同源（GET settings/*） */
interface HomeSummaryState {
  data_root: string
  data_root_resolved: string
  layers: string[]
  llm: Pick<LLMSettingsResponse, 'openai_base_url' | 'openai_model'>
  embedding: Pick<BasicModelSettingsResponse, 'openai_base_url' | 'model'>
  rerank: Pick<BasicModelSettingsResponse, 'openai_base_url' | 'model'>
}

const { Text } = Typography

/** 单行省略；悬停展示全文（与 antd Typography ellipsis 相比，在 Descriptions 表格里更稳定） */
function TruncateLine({ text }: { text: string }) {
  return (
    <Tooltip title={text} placement="topLeft" mouseEnterDelay={0.3}>
      <div
        style={{
          display: 'block',
          width: '100%',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {text}
      </div>
    </Tooltip>
  )
}

function baseUrlCell(v: string | null) {
  if (v == null || v === '') return <Text type="secondary">（未设置，走 SDK 默认端点）</Text>
  return <TruncateLine text={v} />
}

export function Home() {
  const { message } = App.useApp()
  const [summary, setSummary] = useState<HomeSummaryState | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfgRes, llmRes, embRes, rrRes] = await Promise.all([
        api.get<ConfigSummaryResponse>('/api/v1/config'),
        api.get<LLMSettingsResponse>('/api/v1/settings/llm'),
        api.get<BasicModelSettingsResponse>('/api/v1/settings/embedding'),
        api.get<BasicModelSettingsResponse>('/api/v1/settings/rerank'),
      ])
      const cfg = cfgRes.data
      const llm = llmRes.data
      const emb = embRes.data
      const rr = rrRes.data
      setSummary({
        data_root: cfg.data_root,
        data_root_resolved: cfg.data_root_resolved,
        layers: cfg.layers,
        llm: { openai_base_url: llm.openai_base_url, openai_model: llm.openai_model },
        embedding: { openai_base_url: emb.openai_base_url, model: emb.model },
        rerank: { openai_base_url: rr.openai_base_url, model: rr.model },
      })
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '加载失败，请确认服务端已启动')
      console.error(e)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="操作入口" size="small">
        <Space wrap>
          <RouterLink to="/layers">
            <Button type="default">三层存储</Button>
          </RouterLink>
          <RouterLink to="/storage/media">
            <Button type="default">多媒体存储</Button>
          </RouterLink>
          <RouterLink to="/tasks/compile">
            <Button type="default">编译任务</Button>
          </RouterLink>
          <RouterLink to="/tasks/lint">
            <Button type="default">一致性报告</Button>
          </RouterLink>
          <RouterLink to="/tasks/polish">
            <Button type="default">文本润色</Button>
          </RouterLink>
          <RouterLink to="/knowledge-recall/nl">
            <Button type="default">召回知识</Button>
          </RouterLink>
          <RouterLink to="/knowledge-recall/dialogue-test">
            <Button type="default">对话召回测试</Button>
          </RouterLink>
          <RouterLink to="/settings/llm">
            <Button type="default">模型配置</Button>
          </RouterLink>
        </Space>
      </Card>
      <Card title="API 文档" size="small">
        <Typography.Link href="/docs" target="_blank" rel="noreferrer">
          交互式 API 文档
        </Typography.Link>
        <Typography.Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
          若前后端分端口部署，请使用后端地址的 <code>/docs</code>；本页为 dev 代理同域时有效。
        </Typography.Text>
      </Card>
      <Card title="配置摘要" loading={loading} extra={<Button onClick={() => void load()}>刷新</Button>}>
        {summary ? (
          <Descriptions
            className="home-config-summary"
            bordered
            size="small"
            column={1}
            styles={{
              label: { whiteSpace: 'nowrap', verticalAlign: 'top' },
              content: { minWidth: 0 },
            }}
            style={{ width: '100%' }}
          >
            <Descriptions.Item label="data_root">
              <TruncateLine text={summary.data_root} />
            </Descriptions.Item>
            <Descriptions.Item label="当前环境：data_root">
              <TruncateLine text={summary.data_root_resolved} />
            </Descriptions.Item>
            <Descriptions.Item label="LLM Base URL">
              {baseUrlCell(summary.llm.openai_base_url)}
            </Descriptions.Item>
            <Descriptions.Item label="LLM 模型">
              <TruncateLine text={summary.llm.openai_model} />
            </Descriptions.Item>
            <Descriptions.Item label="Embedding Base URL">
              {baseUrlCell(summary.embedding.openai_base_url)}
            </Descriptions.Item>
            <Descriptions.Item label="Embedding 模型">
              <TruncateLine text={summary.embedding.model} />
            </Descriptions.Item>
            <Descriptions.Item label="Rerank Base URL">
              {baseUrlCell(summary.rerank.openai_base_url)}
            </Descriptions.Item>
            <Descriptions.Item label="Rerank 模型">
              <TruncateLine text={summary.rerank.model} />
            </Descriptions.Item>
            <Descriptions.Item label="层目录">
              <TruncateLine text={summary.layers.join(', ')} />
            </Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">暂无数据</Text>
        )}
      </Card>
    </Space>
  )
}
