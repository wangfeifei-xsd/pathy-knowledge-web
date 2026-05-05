import { App, Button, Card, Descriptions, Space, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { api } from '../api/client'
import type { ConfigSummaryResponse } from '../api/types'

const { Text } = Typography

export function Home() {
  const { message } = App.useApp()
  const [config, setConfig] = useState<ConfigSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ConfigSummaryResponse>('/api/v1/config')
      setConfig(data)
    } catch (e) {
      message.error('加载失败，请确认服务端已启动且令牌正确')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="配置摘要（不含密钥）" loading={loading} extra={<Button onClick={() => void load()}>刷新</Button>}>
        {config ? (
          <Descriptions bordered size="small" column={1}>
            <Descriptions.Item label="data_root">{config.data_root}</Descriptions.Item>
            <Descriptions.Item label="data_root（解析）">{config.data_root_resolved}</Descriptions.Item>
            <Descriptions.Item label="OpenAI base_url 已配置">
              {config.openai_base_url_configured ? '是' : '否'}
            </Descriptions.Item>
            <Descriptions.Item label="模型">{config.openai_model}</Descriptions.Item>
            <Descriptions.Item label="超时（秒）">{config.openai_timeout_seconds}</Descriptions.Item>
            <Descriptions.Item label="max_tokens">{config.openai_max_tokens}</Descriptions.Item>
            <Descriptions.Item label="API 密钥已配置">{config.openai_api_key_configured ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="鉴权已启用">{config.auth_enabled ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="层目录">{config.layers.join(', ')}</Descriptions.Item>
          </Descriptions>
        ) : (
          <Text type="secondary">暂无数据</Text>
        )}
      </Card>
      <Card title="操作入口" size="small">
        <Space wrap>
          <RouterLink to="/layers">
            <Button type="default">三层存储</Button>
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
    </Space>
  )
}
