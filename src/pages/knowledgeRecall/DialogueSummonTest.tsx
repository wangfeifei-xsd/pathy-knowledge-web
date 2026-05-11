import { App, Alert, Button, Card, Collapse, Form, Input, InputNumber, Space, Table, Typography } from 'antd'
import { useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { DialogueRecallTestResponse } from '../../api/types'
import { RecallLaneSummary } from './recallLaneUi'

const { Paragraph } = Typography

const SCAN_DEFAULTS = {
  wiki_prefix: '',
  max_files: 80,
  bm25_top_n: 10,
  vector_top_n: 10,
  top_k_chunks: 6,
  chunk_max_chars: 1200,
  context_budget_chars: 12000,
}

export function DialogueSummonTest() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [recallRes, setRecallRes] = useState<DialogueRecallTestResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const onRecallTest = async () => {
    const v = await form.validateFields()
    setBusy(true)
    try {
      const { data } = await api.post<DialogueRecallTestResponse>('/api/v1/dialogue/recall-test', {
        query: v.query,
        wiki_prefix: v.wiki_prefix || undefined,
        max_files: v.max_files,
        bm25_top_n: v.bm25_top_n,
        vector_top_n: v.vector_top_n,
        top_k_chunks: v.top_k_chunks,
        chunk_max_chars: v.chunk_max_chars,
        context_budget_chars: v.context_budget_chars,
        system_prompt: v.system_prompt || undefined,
      })
      setRecallRes(data)
      message.success('对话召回测试完成')
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '召回测试失败')
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="对话召回测试（自然语言 → 召回 → 注入上下文 → 回答）">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="流水线说明"
          description={
            <span>
              在 <strong>wiki</strong> 编译层执行 <strong>BM25 + 向量</strong> 双路召回（各自 topN），合并去重后轻量
              rerank，取 topK 片段注入 Chat Completions，再返回模型回答。与「召回知识」共用服务端逻辑；
              <code>recall_method</code> 为 <code>hybrid_bm25_vector</code>。
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
                key: 'optional-recall',
                label: '可选参数（wiki 前缀、双路 topN、topK 与分块）',
                children: (
                  <>
                    <Form.Item name="wiki_prefix" label="wiki 子路径前缀（可选）">
                      <Input placeholder="留空表示扫描整个 wiki；可填子目录如 notes/" />
                    </Form.Item>
                    <Space wrap style={{ width: '100%' }}>
                      <Form.Item name="max_files" label="最多扫描文件数" style={{ minWidth: 160 }}>
                        <InputNumber min={1} max={500} />
                      </Form.Item>
                      <Form.Item name="bm25_top_n" label="BM25 候选 topN" style={{ minWidth: 160 }}>
                        <InputNumber min={1} max={100} />
                      </Form.Item>
                      <Form.Item name="vector_top_n" label="向量候选 topN" style={{ minWidth: 160 }}>
                        <InputNumber min={1} max={100} />
                      </Form.Item>
                      <Form.Item name="top_k_chunks" label="最终注入 topK" style={{ minWidth: 140 }}>
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
              {
                key: 'optional-llm',
                label: '可选：自定义 system 提示',
                children: (
                  <Form.Item name="system_prompt" label="自定义 system 提示（可选）">
                    <Input.TextArea rows={3} placeholder="留空使用服务端默认：依据参考资料作答、勿编造" />
                  </Form.Item>
                ),
              },
            ]}
          />
          <Button type="primary" onClick={() => void onRecallTest()} loading={busy}>
            执行全流程测试
          </Button>
        </Form>
        {recallRes && (
          <div style={{ marginTop: 16 }}>
            <Paragraph>
              <strong>模型：</strong>
              {recallRes.model} · 召回方式：{recallRes.recall_method} · 扫描文件：{recallRes.files_scanned}
              {recallRes.context_truncated ? ' · 上下文已截断' : ''}
            </Paragraph>
            <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 8 }}>
              <RecallLaneSummary title="BM25" lane={recallRes.bm25} />
              <RecallLaneSummary title="向量" lane={recallRes.vector} showEmbeddingModel />
            </Space>
            <Paragraph type="secondary">
              参与打分的词项（已去停用词）：{recallRes.query_terms.length ? recallRes.query_terms.join('、') : '（无，可能仅含停用词或无法分词）'}
            </Paragraph>
            <Paragraph strong style={{ marginTop: 8 }}>
              召回命中
            </Paragraph>
            <Table
              size="small"
              pagination={false}
              rowKey={(_, i) => String(i)}
              dataSource={recallRes.recall_hits}
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
                  label: '注入 LLM 的参考资料（实际发送片段）',
                  children: (
                    <Input.TextArea value={recallRes.injected_context} readOnly rows={10} />
                  ),
                },
              ]}
            />
            <Paragraph strong style={{ marginTop: 16 }}>
              模型回答
            </Paragraph>
            <Input.TextArea value={recallRes.assistant_reply} readOnly rows={10} />
            {recallRes.usage && (
              <Paragraph type="secondary" style={{ marginTop: 8 }}>
                tokens: {recallRes.usage.total_tokens ?? '—'}（prompt {recallRes.usage.prompt_tokens ?? '—'} /
                completion {recallRes.usage.completion_tokens ?? '—'}）
              </Paragraph>
            )}
            <Paragraph type="secondary">{recallRes.message}</Paragraph>
          </div>
        )}
      </Card>
    </Space>
  )
}
