import {
  Alert,
  App,
  Button,
  Card,
  Collapse,
  Form,
  Input,
  InputNumber,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client'
import type {
  LLMConnectionTestRequest,
  LLMSettingsResponse,
  LLMSettingsUpdateResult,
  LLMTestResponse,
} from '../api/types'

const { Paragraph, Text } = Typography

function sourceTag(src: string): string {
  if (src === 'env') return '环境变量'
  if (src === 'file') return '运行时文件'
  return '默认 / .env'
}

export function ModelSettings() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<LLMSettingsResponse | null>(null)
  const [changeApiKey, setChangeApiKey] = useState(false)
  const [testing, setTesting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<LLMSettingsResponse>('/api/v1/settings/llm')
      setDetail(data)
      form.setFieldsValue({
        openai_model: data.openai_model,
        openai_base_url: data.openai_base_url ?? '',
        openai_timeout_seconds: data.openai_timeout_seconds,
        openai_max_tokens: data.openai_max_tokens,
      })
      setChangeApiKey(false)
    } catch (e) {
      message.error('加载模型配置失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [form, message])

  useEffect(() => {
    void load()
  }, [load])

  const onFinish = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        openai_model: v.openai_model?.trim(),
        openai_base_url: v.openai_base_url?.trim() ?? '',
        openai_timeout_seconds: v.openai_timeout_seconds,
        openai_max_tokens: v.openai_max_tokens,
      }
      if (changeApiKey) {
        const k = (v.openai_api_key as string | undefined)?.trim() ?? ''
        body.openai_api_key = k
      }
      const { data } = await api.put<LLMSettingsUpdateResult>('/api/v1/settings/llm', body)
      setDetail(data.settings)
      if (data.warnings?.length) {
        data.warnings.forEach((w) => message.warning(w))
      } else {
        message.success('已保存')
      }
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
      const m = form.getFieldValue('openai_model') as string | undefined
      const u = form.getFieldValue('openai_base_url') as string | undefined
      if (m != null && String(m).trim()) payload.openai_model = String(m).trim()
      if (u != null && String(u).trim()) payload.openai_base_url = String(u).trim()

      const { data } = await api.post<LLMTestResponse>('/api/v1/settings/llm/test', payload)
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
      const { data } = await api.put<LLMSettingsUpdateResult>('/api/v1/settings/llm', { openai_api_key: '' })
      setDetail(data.settings)
      if (data.warnings?.length) {
        data.warnings.forEach((w) => message.warning(w))
      } else {
        message.success('已清除数据目录中的密钥文件')
      }
      void load()
    } catch (e) {
      message.error('操作失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const locks = detail?.env_locks

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="配置优先级与持久化"
        description={
          <span>
            进程环境变量（如 <code>OPENAI_MODEL</code>）优先于数据目录下{' '}
            <code>{detail?.runtime_llm_json ?? '.pathy/llm.json'}</code>。未列在环境变量中的项可通过本页保存到运行时文件。API
            密钥可来自环境变量、<code>.env</code> 或 <code>.pathy/openai_api_key</code>。
          </span>
        }
      />
      {detail && (
        <Card size="small" title="当前有效值与来源">
          <Paragraph style={{ marginBottom: 0 }}>
            <Text type="secondary">模型</Text> {detail.openai_model}{' '}
            <Text type="secondary">（{sourceTag(detail.openai_model_source)}）</Text>
            <br />
            <Text type="secondary">Base URL</Text> {detail.openai_base_url || '（未设置，走官方或 SDK 默认）'}{' '}
            <Text type="secondary">（{sourceTag(detail.openai_base_url_source)}）</Text>
            <br />
            <Text type="secondary">超时</Text> {detail.openai_timeout_seconds}s{' '}
            <Text type="secondary">（{sourceTag(detail.openai_timeout_source)}）</Text>
            <br />
            <Text type="secondary">max_tokens</Text> {detail.openai_max_tokens}{' '}
            <Text type="secondary">（{sourceTag(detail.openai_max_tokens_source)}）</Text>
            <br />
            <Text type="secondary">API 密钥</Text>{' '}
            {detail.openai_api_key_configured ? '已配置' : '未配置'}
          </Paragraph>
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
                    name="openai_model"
                    label="模型 ID（model）"
                    rules={[{ required: true, message: '请输入模型名' }]}
                    extra={locks?.openai_model ? <Text type="warning">已由 OPENAI_MODEL 环境变量锁定</Text> : null}
                  >
                    <Input disabled={locks?.openai_model} placeholder="如 gpt-4o-mini" />
                  </Form.Item>
                  <Form.Item
                    name="openai_base_url"
                    label="OpenAI Base URL（可选）"
                    extra={
                      locks?.openai_base_url ? (
                        <Text type="warning">已由 OPENAI_BASE_URL 锁定</Text>
                      ) : (
                        '留空表示官方 api.openai.com 兼容端'
                      )
                    }
                  >
                    <Input disabled={locks?.openai_base_url} placeholder="https://api.openai.com/v1" />
                  </Form.Item>
                  <Form.Item
                    name="openai_timeout_seconds"
                    label="请求超时（秒）"
                    rules={[{ required: true }]}
                    extra={locks?.openai_timeout_seconds ? <Text type="warning">已由 OPENAI_TIMEOUT 锁定</Text> : null}
                  >
                    <InputNumber
                      min={5}
                      max={3600}
                      step={1}
                      style={{ width: '100%' }}
                      disabled={locks?.openai_timeout_seconds}
                    />
                  </Form.Item>
                  <Form.Item
                    name="openai_max_tokens"
                    label="max_tokens"
                    rules={[{ required: true }]}
                    extra={locks?.openai_max_tokens ? <Text type="warning">已由 OPENAI_MAX_TOKENS 锁定</Text> : null}
                  >
                    <InputNumber
                      min={256}
                      max={200000}
                      step={256}
                      style={{ width: '100%' }}
                      disabled={locks?.openai_max_tokens}
                    />
                  </Form.Item>
                  <Form.Item label="数据目录中的 API 密钥文件">
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <Switch
                          checked={changeApiKey}
                          onChange={(v) => {
                            setChangeApiKey(v)
                            if (!v) form.setFieldValue('openai_api_key', undefined)
                          }}
                          disabled={locks?.openai_api_key}
                          checkedChildren="写入新密钥"
                          unCheckedChildren="不修改密钥文件"
                        />
                        {locks?.openai_api_key ? (
                          <Text type="warning">OPENAI_API_KEY 环境变量已存在，无法写入 .pathy/openai_api_key</Text>
                        ) : null}
                      </Space>
                      {changeApiKey && !locks?.openai_api_key ? (
                        <Form.Item name="openai_api_key" noStyle>
                          <Input.Password placeholder="保存时写入 data_root/.pathy/openai_api_key；可留空仅清除" />
                        </Form.Item>
                      ) : null}
                      {!locks?.openai_api_key ? (
                        <Button danger type="link" onClick={() => void clearKeyFile()} style={{ padding: 0 }}>
                          清除 .pathy/openai_api_key 文件
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
