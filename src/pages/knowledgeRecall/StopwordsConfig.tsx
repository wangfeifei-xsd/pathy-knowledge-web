import { App, Alert, Button, Card, Input, Space, Tag, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { RecallStopwordsResponse, RecallStopwordsUpdateRequest } from '../../api/types'

const { Paragraph, Text } = Typography

function textToWords(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of text.split('\n')) {
    const w = line.trim().toLowerCase()
    if (!w || w.startsWith('#')) continue
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

export function StopwordsConfig() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resp, setResp] = useState<RecallStopwordsResponse | null>(null)
  const [draft, setDraft] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<RecallStopwordsResponse>('/api/v1/dialogue/stopwords')
      setResp(data)
      setDraft(data.words.join('\n'))
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '加载停用词失败')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void load()
  }, [load])

  const onSave = async () => {
    const words = textToWords(draft)
    const payload: RecallStopwordsUpdateRequest = { words }
    setSaving(true)
    try {
      const { data } = await api.put<RecallStopwordsResponse>('/api/v1/dialogue/stopwords', payload)
      setResp(data)
      setDraft(data.words.join('\n'))
      message.success(`已保存 ${data.count} 个停用词`)
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '保存失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="停用词配置" loading={loading}>
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="说明"
          description="用于 BM25 召回前过滤 query 词项。按行填写，支持 # 注释；保存后立即生效。若此配置文件为空或不存在，服务端回退内置默认词表。"
        />
        <Paragraph>
          <Text strong>来源：</Text>
          {resp?.source === 'runtime_file' ? <Tag color="green">运行时配置文件</Tag> : <Tag>内置默认</Tag>}
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {resp?.runtime_path ?? ''}
          </Text>
        </Paragraph>
        <Input.TextArea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoSize={{ minRows: 14, maxRows: 24 }}
          placeholder={'一行一个停用词\n例如：\n什么\n怎么\n如何\n# 这是注释'}
        />
        <Space style={{ marginTop: 12 }}>
          <Button type="primary" loading={saving} onClick={() => void onSave()}>
            保存停用词
          </Button>
          <Button onClick={() => void load()} disabled={loading || saving}>
            重新加载
          </Button>
        </Space>
      </Card>
    </Space>
  )
}
