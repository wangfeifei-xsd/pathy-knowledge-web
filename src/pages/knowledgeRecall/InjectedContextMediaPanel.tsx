import { App, Collapse, Space, Spin, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useEffect, useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import { mediaBinaryUrl } from '../../api/mediaUrls'
import type { MediaRef, MediaResolvedItem, MediaResolveFromTextResponse } from '../../api/types'

/** 与召回 / 召回测试结果中用于展示注入正文与合并媒体的最小字段一致 */
export type RecallInjectedBundle = {
  injected_context: string
  merged_media: MediaRef[]
}

function formatBytes(n: number): string {
  if (n <= 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function isImageMime(m: string): boolean {
  return /^image\//i.test(m)
}

function isVideoMime(m: string): boolean {
  return /^video\//i.test(m)
}

export function InjectedContextMediaPanel({ recall }: { recall: RecallInjectedBundle | null }) {
  const { message } = App.useApp()
  const [loading, setLoading] = useState(false)
  const [resolved, setResolved] = useState<MediaResolveFromTextResponse | null>(null)

  useEffect(() => {
    if (!recall) {
      setResolved(null)
      return
    }
    const extra = (recall.merged_media ?? []).map((m) => m.code)
    const text = recall.injected_context ?? ''
    if (!text.trim() && extra.length === 0) {
      setResolved(null)
      return
    }
    let cancelled = false
    setLoading(true)
    void api
      .post<MediaResolveFromTextResponse>('/api/v1/media/resolve-from-text', {
        text,
        codes: extra,
      })
      .then(({ data }) => {
        if (!cancelled) setResolved(data)
      })
      .catch((e) => {
        if (!cancelled) {
          message.error(apiErrorDetail(e) ?? '解析多媒体标签失败')
          console.error(e)
          setResolved(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [recall])

  if (!recall) return null

  const count = resolved?.codes.length ?? 0
  const previewItems = (resolved?.items ?? []).filter(
    (i) => i.registered && (isImageMime(i.mime) || isVideoMime(i.mime)),
  )

  const columns: ColumnsType<MediaResolvedItem> = [
    { title: 'code', dataIndex: 'code', key: 'code', ellipsis: true, width: 200 },
    {
      title: '已登记',
      dataIndex: 'registered',
      key: 'registered',
      width: 88,
      render: (v: boolean) => (v ? <Tag color="success">是</Tag> : <Tag color="warning">否</Tag>),
    },
    { title: 'MIME', dataIndex: 'mime', key: 'mime', width: 140, ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
      render: (n: number) => formatBytes(n),
    },
    {
      title: '资源',
      key: 'open',
      width: 96,
      render: (_, row) =>
        row.registered ? (
          <Typography.Link href={mediaBinaryUrl(row.code)} target="_blank" rel="noreferrer">
            打开
          </Typography.Link>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ]

  return (
    <Collapse
      style={{ marginTop: 12 }}
      items={[
        {
          key: 'injected-media',
          label: (
            <Space>
              <span>merged_media（登记校验 + 内联预览）</span>
              {loading ? <Spin size="small" /> : <Tag>{count} 个</Tag>}
            </Space>
          ),
          children: (
            <>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 8, fontSize: 12 }}>
                以 <Typography.Text code>merged_media</Typography.Text> 的 code 为主调用{' '}
                <Typography.Text code>POST /api/v1/media/resolve-from-text</Typography.Text>（可附带{' '}
                <Typography.Text code>injected_context</Typography.Text> 做正文内残留标签解析）。图片/视频在下方通过{' '}
                <Typography.Text code>GET /api/v1/media/&lt;code&gt;</Typography.Text> 同源加载。
                <br />
                「仅召回」页：<Typography.Text code>injected_context</Typography.Text> 仅供人工核对，不会请求模型。「对话召回测试」页：该字段与待答问题一并写入发给模型的{' '}
                <strong>user</strong> 消息。媒体不在 prompt 内，仅在此通过 <Typography.Text code>merged_media</Typography.Text> 与 GET 二进制展示。
              </Typography.Paragraph>
              {count === 0 && !loading ? (
                <Typography.Text type="secondary">无合并媒体或未解析到可登记项。</Typography.Text>
              ) : (
                <Table
                  size="small"
                  rowKey="code"
                  pagination={false}
                  loading={loading}
                  dataSource={resolved?.items ?? []}
                  columns={columns}
                />
              )}
              {!loading && previewItems.length > 0 ? (
                <>
                  <Typography.Paragraph strong style={{ marginTop: 16, marginBottom: 8 }}>
                    媒体预览
                  </Typography.Paragraph>
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 16,
                      alignItems: 'flex-start',
                    }}
                  >
                    {previewItems.map((item) => {
                      const url = mediaBinaryUrl(item.code)
                      if (isImageMime(item.mime)) {
                        return (
                          <div key={item.code} style={{ maxWidth: 280 }}>
                            <img
                              alt=""
                              src={url}
                              style={{
                                maxHeight: 160,
                                maxWidth: '100%',
                                objectFit: 'contain',
                                display: 'block',
                                borderRadius: 6,
                                border: '1px solid #f0f0f0',
                              }}
                            />
                            <Typography.Text
                              type="secondary"
                              ellipsis
                              copyable={{ text: item.code }}
                              style={{ fontSize: 11, display: 'block', marginTop: 4, maxWidth: 280 }}
                            >
                              {item.code}
                            </Typography.Text>
                          </div>
                        )
                      }
                      return (
                        <div key={item.code} style={{ maxWidth: 400 }}>
                          <video controls style={{ maxHeight: 220, maxWidth: '100%' }} src={url}>
                            <track kind="captions" />
                          </video>
                          <Typography.Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                            {item.code}
                          </Typography.Text>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : null}
            </>
          ),
        },
      ]}
    />
  )
}
