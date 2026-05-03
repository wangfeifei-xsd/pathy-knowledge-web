import { App, Button, Card, Checkbox, Form, Input, InputNumber, Space, Typography } from 'antd'
import { useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { LintTaskResponse } from '../../api/types'

const { Paragraph } = Typography

export function LintReport() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [lintRes, setLintRes] = useState<LintTaskResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const onLint = async () => {
    const v = await form.validateFields()
    setBusy(true)
    try {
      const wiki_paths = v.wiki_paths
        ? v.wiki_paths
            .split(/\r?\n/)
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined
      const { data } = await api.post<LintTaskResponse>('/api/v1/tasks/lint', {
        wiki_paths,
        auto_fix: v.auto_fix,
        max_files: v.max_files,
      })
      setLintRes(data)
      message.success('Lint 完成')
    } catch (e) {
      message.error(apiErrorDetail(e) ?? 'Lint 失败')
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="一致性报告（Lint）">
        <Form form={form} layout="vertical" initialValues={{ auto_fix: false, max_files: 50 }}>
          <Form.Item name="wiki_paths" label="wiki 路径（每行一个，留空则扫描一层）">
            <Input.TextArea rows={4} placeholder="留空：扫描 wiki 下至多 max_files 个 .md" />
          </Form.Item>
          <Form.Item name="max_files" label="最多检查文件数">
            <InputNumber min={1} max={500} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="auto_fix" valuePropName="checked">
            <Checkbox>将报告写入 wiki/_lint_report.md（不自动改正文）</Checkbox>
          </Form.Item>
          <Button onClick={() => void onLint()} loading={busy}>
            执行 Lint
          </Button>
        </Form>
        {lintRes && (
          <div style={{ marginTop: 16 }}>
            <Paragraph>
              <strong>模型：</strong>
              {lintRes.model}
            </Paragraph>
            <Paragraph type="secondary">检查文件：{lintRes.files_inspected.join(', ') || '无'}</Paragraph>
            <Input.TextArea value={lintRes.report} readOnly rows={12} style={{ marginTop: 8 }} />
          </div>
        )}
      </Card>
    </Space>
  )
}
