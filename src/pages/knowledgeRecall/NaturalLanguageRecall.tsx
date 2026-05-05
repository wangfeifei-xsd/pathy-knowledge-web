import { App, Alert, Button, Card, Collapse, Form, Input, InputNumber, Space, Table, Typography } from 'antd'
import { useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { DialogueRecallRequest, DialogueRecallResponse } from '../../api/types'

const { Paragraph } = Typography

const SCAN_DEFAULTS = {
  wiki_prefix: '',
  max_files: 80,
  top_k_chunks: 6,
  chunk_max_chars: 1200,
  context_budget_chars: 12000,
}

export function NaturalLanguageRecall() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [res, setRes] = useState<DialogueRecallResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async () => {
    const v = await form.validateFields()
    setBusy(true)
    try {
      const payload: DialogueRecallRequest = {
        query: v.query,
        wiki_prefix: v.wiki_prefix || undefined,
        max_files: v.max_files,
        top_k_chunks: v.top_k_chunks,
        chunk_max_chars: v.chunk_max_chars,
        context_budget_chars: v.context_budget_chars,
      }
      const { data } = await api.post<DialogueRecallResponse>('/api/v1/dialogue/recall', payload)
      setRes(data)
      message.success('召回完成')
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '召回失败')
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="召回知识">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="说明"
          description={
            <span>
              在 <strong>wiki</strong> 编译层用 <strong>BM25</strong> 关键词召回（按 Markdown 标题切块、停用词过滤、标题路径命中加权；非向量），按预算拼接为「参考资料」正文；<strong>不调用
              LLM</strong>。与「对话召回测试」共用服务端实现（<code>/api/v1/dialogue/recall</code>）。返回字段{' '}
              <code>recall_method</code> 为 <code>bm25</code>。
            </span>
          }
        />
        <Form form={form} layout="vertical" initialValues={SCAN_DEFAULTS}>
          <Form.Item
            name="query"
            label="自然语言输入"
            rules={[{ required: true, message: '请输入问句或指令' }]}
          >
            <Input.TextArea rows={4} placeholder="例如：知识库里关于 XXX 的说明是什么？" />
          </Form.Item>
          <Collapse
            bordered={false}
            style={{ marginBottom: 8, background: 'transparent' }}
            defaultActiveKey={[]}
            items={[
              {
                key: 'optional-scan',
                label: '可选参数（wiki 前缀、扫描范围与分块）',
                children: (
                  <>
                    <Form.Item name="wiki_prefix" label="wiki 子路径前缀（可选）">
                      <Input placeholder="留空表示扫描整个 wiki；可填子目录如 notes/" />
                    </Form.Item>
                    <Space wrap style={{ width: '100%' }}>
                      <Form.Item name="max_files" label="最多扫描文件数" style={{ minWidth: 160 }}>
                        <InputNumber min={1} max={500} />
                      </Form.Item>
                      <Form.Item name="top_k_chunks" label="召回片段数" style={{ minWidth: 140 }}>
                        <InputNumber min={1} max={32} />
                      </Form.Item>
                      <Form.Item name="chunk_max_chars" label="单片段最大字符" style={{ minWidth: 160 }}>
                        <InputNumber min={400} max={8000} />
                      </Form.Item>
                      <Form.Item name="context_budget_chars" label="上下文总预算" style={{ minWidth: 160 }}>
                        <InputNumber min={2000} max={100000} step={1000} />
                      </Form.Item>
                    </Space>
                  </>
                ),
              },
            ]}
          />
          <Button type="primary" onClick={() => void onSubmit()} loading={busy}>
            执行召回
          </Button>
        </Form>
        {res && (
          <div style={{ marginTop: 16 }}>
            <Paragraph>
              <strong>召回方式：</strong>
              {res.recall_method} · 扫描文件：{res.files_scanned}
              {res.context_truncated ? ' · 上下文已截断' : ''}
            </Paragraph>
            <Paragraph type="secondary">
              参与打分的词项（已去停用词）：{res.query_terms.length ? res.query_terms.join('、') : '（无，可能仅含停用词或无法分词）'}
            </Paragraph>
            <Paragraph strong style={{ marginTop: 8 }}>
              召回命中
            </Paragraph>
            <Table
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={res.recall_hits}
              columns={[
                { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
                { title: '得分', dataIndex: 'score', key: 'score', width: 100 },
                { title: '预览', dataIndex: 'snippet', key: 'snippet', ellipsis: true },
              ]}
            />
            <Collapse
              style={{ marginTop: 12 }}
              items={[
                {
                  key: 'ctx',
                  label: '拼接后的参考资料（与全流程注入块一致）',
                  children: <Input.TextArea value={res.injected_context} readOnly rows={10} />,
                },
              ]}
            />
            <Paragraph type="secondary" style={{ marginTop: 8 }}>
              {res.message}
            </Paragraph>
          </div>
        )}
      </Card>
    </Space>
  )
}
