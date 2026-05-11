import { App, Alert, Button, Card, Collapse, Input, Popconfirm, Space, Table, Tag, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { TableProps } from 'antd'
import type { RecallStopwordsResponse, RecallStopwordsUpdateRequest } from '../../api/types'

const { Paragraph, Text } = Typography

/** 与保存逻辑一致：小写、去空、去 # 行、去重（保序：先出现的保留） */
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

function normalizeWord(raw: string): string {
  return raw.trim().toLowerCase()
}

type Row = { key: number; word: string }

export function StopwordsConfig() {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resp, setResp] = useState<RecallStopwordsResponse | null>(null)
  /** 当前编辑中的词表（与接口 `words` 一一对应，顺序即保存顺序） */
  const [words, setWords] = useState<string[]>([])
  const [newWord, setNewWord] = useState('')
  const [bulkText, setBulkText] = useState('')
  /** 受控分页：与 scroll.y 同用时必须显式 total + onChange，否则「每页条数」不生效 */
  const [tablePage, setTablePage] = useState({ current: 1, pageSize: 80 })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<RecallStopwordsResponse>('/api/v1/dialogue/stopwords')
      setResp(data)
      setWords([...data.words])
      setTablePage({ current: 1, pageSize: 80 })
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

  const dataSource: Row[] = useMemo(
    () => words.map((word, i) => ({ key: i, word })),
    [words],
  )

  const updateWordAt = (index: number, raw: string) => {
    setWords((prev) => {
      const next = [...prev]
      next[index] = raw
      return next
    })
  }

  const removeAt = (index: number) => {
    setWords((prev) => prev.filter((_, i) => i !== index))
  }

  const addSingle = () => {
    const w = normalizeWord(newWord)
    if (!w) {
      message.warning('请输入非空词项')
      return
    }
    if (w.startsWith('#')) {
      message.warning('词项不能以 # 开头（# 仅用于批量粘贴区的注释行）')
      return
    }
    const existing = new Set(words.map((x) => normalizeWord(x)).filter(Boolean))
    if (existing.has(w)) {
      message.info('列表中已有该词')
      return
    }
    setWords((prev) => [...prev, w])
    setNewWord('')
  }

  const mergeBulk = () => {
    const parsed = textToWords(bulkText)
    if (parsed.length === 0) {
      message.warning('未解析到有效词项（空行、# 注释行已忽略）')
      return
    }
    const seen = new Set<string>()
    const merged: string[] = []
    for (const w of [...words.map((x) => normalizeWord(x)).filter(Boolean), ...parsed]) {
      if (seen.has(w)) continue
      seen.add(w)
      merged.push(w)
    }
    setWords(merged)
    setBulkText('')
    message.success(`已合并，当前共 ${merged.length} 条（粘贴区解析 ${parsed.length} 条，已与上表去重合并）`)
  }

  const onSave = async () => {
    const normalized = textToWords(words.join('\n'))
    const payload: RecallStopwordsUpdateRequest = { words: normalized }
    setSaving(true)
    try {
      const { data } = await api.put<RecallStopwordsResponse>('/api/v1/dialogue/stopwords', payload)
      setResp(data)
      setWords([...data.words])
      setTablePage({ current: 1, pageSize: tablePage.pageSize })
      message.success(`已保存 ${data.count} 个停用词`)
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '保存失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const dedupedPreview = useMemo(() => textToWords(words.join('\n')), [words])

  const totalRows = words.length
  const maxPage = Math.max(1, Math.ceil(totalRows / tablePage.pageSize) || 1)

  useEffect(() => {
    if (tablePage.current > maxPage) {
      setTablePage((p) => ({ ...p, current: maxPage }))
    }
  }, [maxPage, tablePage.current])

  const onTableChange: TableProps<Row>['onChange'] = (pag) => {
    const nextSize = pag.pageSize ?? tablePage.pageSize
    const sizeChanged = nextSize !== tablePage.pageSize
    setTablePage({
      current: sizeChanged ? 1 : (pag.current ?? 1),
      pageSize: nextSize,
    })
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="停用词配置" loading={loading}>
        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 16 }}
          message="说明"
          description={
            <ul style={{ margin: 0, paddingLeft: 20, marginBottom: 0 }}>
              <li>用于 BM25 召回前过滤 query 词项；保存后立即生效。</li>
              <li>下表逐行维护：可编辑词面、删除行、添加单行；大段可从「批量粘贴」合并（支持 # 注释行）。</li>
              <li>若运行时配置文件为空或不存在，服务端回退内置默认词表。</li>
            </ul>
          }
        />
        <Paragraph style={{ marginBottom: 12 }}>
          <Text strong>来源：</Text>
          {resp?.source === 'runtime_file' ? <Tag color="green">运行时配置文件</Tag> : <Tag>内置默认</Tag>}
          <Text type="secondary" style={{ marginLeft: 8 }}>
            {resp?.runtime_path ?? ''}
          </Text>
          <Text type="secondary" style={{ marginLeft: 12 }}>
            当前列表 {words.length} 条 · 保存时将规范化并去重为 {dedupedPreview.length} 条
          </Text>
        </Paragraph>

        <Space wrap style={{ marginBottom: 12 }} align="center">
          <Input
            style={{ width: 220 }}
            placeholder="新停用词"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onPressEnter={() => addSingle()}
            allowClear
          />
          <Button type="primary" onClick={() => addSingle()}>
            添加一行
          </Button>
        </Space>

        <Table<Row>
          size="small"
          rowKey="key"
          dataSource={dataSource}
          scroll={{ x: 520, y: 420 }}
          pagination={{
            current: tablePage.current,
            pageSize: tablePage.pageSize,
            total: totalRows,
            showSizeChanger: true,
            pageSizeOptions: ['40', '80', '160', '320'],
            showTotal: (t) => `共 ${t} 条`,
            hideOnSinglePage: false,
          }}
          onChange={onTableChange}
          columns={[
            {
              title: '#',
              width: 56,
              align: 'center',
              render: (_, record) => record.key + 1,
            },
            {
              title: '词项',
              dataIndex: 'word',
              ellipsis: true,
              render: (text: string, record) => (
                <Input
                  value={text}
                  onChange={(e) => updateWordAt(record.key, e.target.value)}
                  placeholder="停用词"
                  size="small"
                />
              ),
            },
            {
              title: '操作',
              width: 88,
              align: 'center',
              render: (_, record) => (
                <Popconfirm title="删除该行？" okText="删除" cancelText="取消" onConfirm={() => removeAt(record.key)}>
                  <Button type="link" size="small" danger style={{ padding: 0 }}>
                    删除
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />

        <Collapse
          style={{ marginTop: 12 }}
          items={[
            {
              key: 'bulk',
              label: '批量粘贴（一行一词，支持 # 注释）',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Input.TextArea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    rows={8}
                    placeholder={'一行一个停用词\n例如：\n什么\n怎么\n如何\n# 这是注释'}
                    style={{ resize: 'none' }}
                  />
                  <Space wrap>
                    <Button onClick={() => mergeBulk()}>解析并合并到上表</Button>
                    <Button type="text" onClick={() => setBulkText('')}>
                      清空粘贴区
                    </Button>
                  </Space>
                </Space>
              ),
            },
          ]}
        />

        <Space style={{ marginTop: 16 }}>
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
