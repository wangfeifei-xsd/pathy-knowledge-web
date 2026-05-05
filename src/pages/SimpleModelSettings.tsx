import { Alert, App, Button, Card, Collapse, Form, Input, InputNumber, Space, Spin, Switch, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type {
  BasicModelSettingsResponse,
  BasicModelSettingsUpdateResult,
  LLMConnectionTestRequest,
  LLMTestResponse,
} from '../api/types'

const { Text } = Typography

function sourceTag(src: string): string {
  if (src === 'env') return '环境变量'
  if (src === 'file') return '运行时文件'
  return '默认 / .env'
}

export function SimpleModelSettings({
  title,
  endpoint,
  testEndpoint,
  lockKey,
  keyFileLabel,
}: {
  title: string
  endpoint: '/api/v1/settings/embedding' | '/api/v1/settings/rerank'
  testEndpoint: '/api/v1/settings/embedding/test' | '/api/v1/settings/rerank/test'
  lockKey: 'embedding_model' | 'rerank_model'
  keyFileLabel: '.pathy/embedding_api_key' | '.pathy/rerank_api_key'
}) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<BasicModelSettingsResponse | null>(null)
  const [changeApiKey, setChangeApiKey] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<BasicModelSettingsResponse>(endpoint)
      setDetail(data)
      form.setFieldsValue({
        model: data.model,
        openai_base_url: data.openai_base_url ?? '',
        openai_timeout_seconds: data.openai_timeout_seconds,
        openai_max_tokens: data.openai_max_tokens,
      })
      setChangeApiKey(false)
    } catch (e) {
      message.error('加载配置失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [endpoint, form, message])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        model: String(v.model || '').trim(),
        openai_base_url: String(v.openai_base_url || '').trim(),
        openai_timeout_seconds: v.openai_timeout_seconds,
        openai_max_tokens: v.openai_max_tokens,
      }
      if (changeApiKey) body.openai_api_key = String(v.openai_api_key || '').trim()
      const { data } = await api.put<BasicModelSettingsUpdateResult>(endpoint, body)
      setDetail(data.settings)
      if (data.warnings?.length) data.warnings.forEach((w) => message.warning(w))
      else message.success('已保存')
      void load()
    } catch (e) {
      message.error('保存失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    setTesting(true)
    try {
      const payload: LLMConnectionTestRequest = {}
      const m = form.getFieldValue('model') as string | undefined
      const u = form.getFieldValue('openai_base_url') as string | undefined
      if (m != null && String(m).trim()) payload.openai_model = String(m).trim()
      if (u != null && String(u).trim()) payload.openai_base_url = String(u).trim()
      const { data } = await api.post<LLMTestResponse>(testEndpoint, payload)
      if (data.ok) {
        const tok = data.usage?.total_tokens != null ? ` · tokens ${data.usage.total_tokens}` : ''
        message.success(`连接成功 · ${data.elapsed_ms.toFixed(0)} ms · ${data.model}${tok}`)
      } else {
        message.error(data.error || '连接失败')
      }
    } catch (e) {
      message.error('测试请求失败')
      console.error(e)
    } finally {
      setTesting(false)
    }
  }

  const clearKeyFile = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<BasicModelSettingsUpdateResult>(endpoint, { openai_api_key: '' })
      setDetail(data.settings)
      if (data.warnings?.length) data.warnings.forEach((w) => message.warning(w))
      else message.success(`已清除 ${keyFileLabel} 文件`)
      void load()
    } catch (e) {
      message.error('操作失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const locked = Boolean(detail?.env_locks?.[lockKey])
  const lockBaseUrl = Boolean(detail?.env_locks?.openai_base_url)
  const lockTimeout = Boolean(detail?.env_locks?.openai_timeout_seconds)
  const lockMaxTokens = Boolean(detail?.env_locks?.openai_max_tokens)
  const lockApiKey = Boolean(detail?.env_locks?.openai_api_key)

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert type="info" showIcon message={title} description="用于控制向量召回与重排序的模型 ID。环境变量优先于运行时文件。" />
      {detail && (
        <Card size="small" title="当前有效值与来源">
          <p style={{ marginBottom: 8 }}>
            <Text>模型：</Text>
            <Text>{detail.model}</Text>
            <Text type="secondary">（{sourceTag(detail.model_source)}）</Text>
          </p>
          <p style={{ marginBottom: 8 }}>
            <Text>Base URL：</Text>
            <Text>{detail.openai_base_url || '（未设置）'}</Text>
            <Text type="secondary">（{sourceTag(detail.openai_base_url_source)}）</Text>
          </p>
          <p style={{ marginBottom: 8 }}>
            <Text>超时：</Text>
            <Text>{detail.openai_timeout_seconds}s</Text>
            <Text type="secondary">（{sourceTag(detail.openai_timeout_source)}）</Text>
          </p>
          <p style={{ marginBottom: 0 }}>
            <Text>max_tokens：</Text>
            <Text>{detail.openai_max_tokens}</Text>
            <Text type="secondary">（{sourceTag(detail.openai_max_tokens_source)}）</Text>
          </p>
        </Card>
      )}
      <Collapse
        bordered
        defaultActiveKey={[]}
        expandIconPosition="start"
        items={[
          {
            key: 'edit',
            label: <span style={{ fontWeight: 600 }}>编辑运行时配置</span>,
            extra: (
              <div onClick={(e) => e.stopPropagation()}>
                <Space>
                  <Button type="primary" ghost loading={testing} onClick={() => void testConnection()}>
                    测试连接
                  </Button>
                  <Button onClick={() => void load()}>重新加载</Button>
                </Space>
              </div>
            ),
            children: (
              <Spin spinning={loading}>
                <Form form={form} layout="vertical" onFinish={() => void onFinish()}>
            <Form.Item
              name="model"
              label="模型 ID（model）"
              rules={[{ required: true, message: '请输入模型名' }]}
              extra={locked ? <Text type="warning">已由环境变量锁定</Text> : null}
            >
              <Input disabled={locked} />
            </Form.Item>
            <Form.Item
              name="openai_base_url"
              label="OpenAI Base URL（可选）"
              extra={lockBaseUrl ? <Text type="warning">已由环境变量锁定</Text> : null}
            >
              <Input disabled={lockBaseUrl} placeholder="https://api.openai.com/v1" />
            </Form.Item>
            <Form.Item
              name="openai_timeout_seconds"
              label="请求超时（秒）"
              rules={[{ required: true }]}
              extra={lockTimeout ? <Text type="warning">已由环境变量锁定</Text> : null}
            >
              <InputNumber min={5} max={3600} step={1} style={{ width: '100%' }} disabled={lockTimeout} />
            </Form.Item>
            <Form.Item
              name="openai_max_tokens"
              label="max_tokens"
              rules={[{ required: true }]}
              extra={lockMaxTokens ? <Text type="warning">已由环境变量锁定</Text> : null}
            >
              <InputNumber min={256} max={200000} step={256} style={{ width: '100%' }} disabled={lockMaxTokens} />
            </Form.Item>
            <Form.Item label="API 密钥文件">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Switch
                  checked={changeApiKey}
                  onChange={(v) => {
                    setChangeApiKey(v)
                    if (!v) form.setFieldValue('openai_api_key', undefined)
                  }}
                  disabled={lockApiKey}
                  checkedChildren="写入新密钥"
                  unCheckedChildren="不修改密钥文件"
                />
                {changeApiKey && !lockApiKey ? (
                  <Form.Item name="openai_api_key" noStyle>
                    <Input.Password placeholder="保存时写入 .pathy/openai_api_key；留空表示清除" />
                  </Form.Item>
                ) : null}
                {lockApiKey ? <Text type="warning">API 密钥环境变量已锁定</Text> : null}
                {!lockApiKey ? (
                  <Button danger type="link" onClick={() => void clearKeyFile()} style={{ padding: 0 }}>
                    清除 {keyFileLabel} 文件
                  </Button>
                ) : null}
              </Space>
            </Form.Item>
            <Form.Item>
              <Space wrap>
                <Button type="primary" htmlType="submit" loading={saving}>
                  保存到运行时配置
                </Button>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  「测试连接」发极小 Chat（ping）；优先用表单中的模型与 Base URL，留空则用服务端当前有效配置。
                </Text>
              </Space>
            </Form.Item>
                </Form>
              </Spin>
            ),
          },
        ]}
      />
    </Space>
  )
}
