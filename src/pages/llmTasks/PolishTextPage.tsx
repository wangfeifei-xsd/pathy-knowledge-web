import { App, Alert, Button, Card, Form, Input, Space, Typography } from 'antd'
import { useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { PolishTextResponse } from '../../api/types'

const { Paragraph } = Typography

export function PolishTextPage() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [res, setRes] = useState<PolishTextResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    const v = await form.validateFields()
    setBusy(true)
    try {
      const { data } = await api.post<PolishTextResponse>('/api/v1/tasks/polish-text', {
        content: v.content,
        instruction: v.instruction?.trim() || undefined,
      })
      setRes(data)
      message.success('润色完成')
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '润色失败（需配置模型与密钥）')
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="文本润色">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="说明"
          description={
            <span>
              调用服务端 <code>POST /api/v1/tasks/polish-text</code>，适用于规范层 Markdown、草稿段落等任意文本；与三层存储里的「新建
              schema / 润色草稿」能力一致，此处便于粘贴<strong>任意长度</strong>内容单独润色。
            </span>
          }
        />
        <Form form={form} layout="vertical">
          <Form.Item
            name="content"
            label="待润色正文"
            rules={[{ required: true, message: '请输入正文' }]}
          >
            <Input.TextArea rows={12} placeholder="粘贴 Markdown 或纯文本…" />
          </Form.Item>
          <Form.Item name="instruction" label="额外指令（可选）">
            <Input.TextArea
              rows={2}
              placeholder="例如：统一术语为「xxx」、压缩篇幅、保留标题层级…"
            />
          </Form.Item>
          <Button type="primary" onClick={() => void onSubmit()} loading={busy}>
            执行润色
          </Button>
        </Form>
        {res && (
          <div style={{ marginTop: 16 }}>
            <Paragraph>
              <strong>模型：</strong>
              {res.model}
            </Paragraph>
            <Paragraph strong>润色结果</Paragraph>
            <Input.TextArea value={res.content} readOnly rows={14} />
            {res.usage && (
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                tokens: {res.usage.total_tokens ?? '—'}（prompt {res.usage.prompt_tokens ?? '—'} /
                completion {res.usage.completion_tokens ?? '—'}）
              </Paragraph>
            )}
          </div>
        )}
      </Card>
    </Space>
  )
}
