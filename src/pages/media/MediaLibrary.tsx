import {
  CopyOutlined,
  DownloadOutlined,
  ImportOutlined,
  LinkOutlined,
  ReloadOutlined,
  SearchOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import {
  App,
  Alert,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Space,
  Table,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { UploadProps } from 'antd/es/upload/interface'
import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'
import type { Key } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import { mediaBinaryUrl } from '../../api/mediaUrls'
import type {
  MediaBackrefsResponse,
  MediaImportZipResponse,
  MediaListItem,
  MediaListResponse,
  MediaUploadResponse,
} from '../../api/types'

const { Paragraph, Text } = Typography

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function parseDispositionFilename(cd: string | undefined): string | undefined {
  if (!cd) return undefined
  const m = /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"/i.exec(cd)
  if (m?.[1]) return decodeURIComponent(m[1].replace(/^"+|"+$/g, ''))
  if (m?.[2]) return m[2]
  return undefined
}

function triggerDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.click()
  URL.revokeObjectURL(url)
}

function isImageMime(m: string): boolean {
  return /^image\//i.test(m)
}

function isVideoMime(m: string): boolean {
  return /^video\//i.test(m)
}

export function MediaLibrary() {
  const { message } = App.useApp()
  const [list, setList] = useState<MediaListResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [reindexBusy, setReindexBusy] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [backrefOpen, setBackrefOpen] = useState(false)
  const [backrefCode, setBackrefCode] = useState<string | null>(null)
  const [backrefData, setBackrefData] = useState<MediaBackrefsResponse | null>(null)
  const [backrefLoading, setBackrefLoading] = useState(false)
  const [preview, setPreview] = useState<{ code: string; mime: string } | null>(null)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [exportBusy, setExportBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importTargetDir, setImportTargetDir] = useState('')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importBusy, setImportBusy] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<MediaListResponse>('/api/v1/media/items')
      setList(data)
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '加载媒体列表失败')
      console.error(e)
      setList(null)
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!list) return
    if (list.items.length === 0) {
      setSelectedRowKeys([])
      return
    }
    const valid = new Set(list.items.map((i) => i.code))
    setSelectedRowKeys((prev) => prev.filter((k) => valid.has(String(k))))
  }, [list])

  const onReindex = async () => {
    setReindexBusy(true)
    try {
      const { data } = await api.post<{ codes_with_refs: number; total_ref_rows: number; message: string }>(
        '/api/v1/media/reindex-backrefs',
      )
      message.success(
        `反向索引完成：${data.codes_with_refs} 个 code，共 ${data.total_ref_rows} 条引用`,
      )
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '重建索引失败')
      console.error(e)
    } finally {
      setReindexBusy(false)
    }
  }

  const openBackrefs = async (code: string) => {
    setBackrefCode(code)
    setBackrefOpen(true)
    setBackrefLoading(true)
    setBackrefData(null)
    try {
      const { data } = await api.get<MediaBackrefsResponse>(`/api/v1/media/${encodeURIComponent(code)}/backrefs`)
      setBackrefData(data)
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '加载反向引用失败')
      console.error(e)
    } finally {
      setBackrefLoading(false)
    }
  }

  const copy = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success(okMsg)
    } catch {
      message.warning('复制失败，请手动选择文本')
    }
  }

  const copySelectedCodes = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要复制的行')
      return
    }
    const text = selectedRowKeys.map(String).join('  ')
    void copy(text, `已复制 ${selectedRowKeys.length} 个 code`)
  }

  const copySelectedPlaceholders = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要复制的行')
      return
    }
    const text = selectedRowKeys.map((k) => `![[MEDIA:${k}]]`).join('  ')
    void copy(text, `已复制 ${selectedRowKeys.length} 个 wiki 占位符`)
  }

  const exportSelectedZip = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要导出的资源')
      return
    }
    setExportBusy(true)
    try {
      const codes = selectedRowKeys.map(String)
      const res = await api.post<Blob>('/api/v1/media/export-zip', { codes }, { responseType: 'blob' })
      const blob = res.data
      const cd = res.headers['content-disposition'] ?? res.headers['Content-Disposition']
      const name = parseDispositionFilename(typeof cd === 'string' ? cd : undefined) ?? 'pathy-media-export.zip'
      triggerDownloadBlob(blob, name)
      message.success(`已开始下载：${name}`)
    } catch (e) {
      if (axios.isAxiosError(e) && e.response?.data instanceof Blob) {
        try {
          const t = await e.response.data.text()
          const j = JSON.parse(t) as { detail?: unknown }
          const d = j.detail
          message.error(typeof d === 'string' ? d : '导出失败')
        } catch {
          message.error(apiErrorDetail(e) ?? '导出失败')
        }
      } else {
        message.error(apiErrorDetail(e) ?? '导出失败')
      }
      console.error(e)
    } finally {
      setExportBusy(false)
    }
  }

  const submitImportZip = async () => {
    if (!importFile) {
      message.warning('请选择 zip 文件')
      return
    }
    setImportBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const t = importTargetDir.trim()
      if (t) fd.append('target_dir', t)
      const { data } = await api.post<MediaImportZipResponse>('/api/v1/media/import-zip', fd)
      message.success(data.message)
      const errs = data.results.filter((r) => r.status === 'error')
      if (errs.length > 0) {
        Modal.warning({
          title: '部分条目失败',
          width: 640,
          content: (
            <Table
              size="small"
              pagination={{ pageSize: 8 }}
              rowKey={(_, i) => String(i)}
              dataSource={errs}
              columns={[
                { title: 'source', dataIndex: 'source_code', key: 's', ellipsis: true },
                { title: '说明', dataIndex: 'detail', key: 'd', ellipsis: true },
              ]}
            />
          ),
        })
      }
      setImportOpen(false)
      setImportFile(null)
      setImportTargetDir('')
      void loadList()
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '导入失败')
      console.error(e)
    } finally {
      setImportBusy(false)
    }
  }

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: true,
    customRequest: async (options) => {
      const { file, onError, onSuccess } = options
      const fd = new FormData()
      fd.append('file', file as Blob)
      const t = uploadTitle.trim()
      if (t) fd.append('title', t)
      try {
        const { data } = await api.post<MediaUploadResponse>('/api/v1/media/upload', fd)
        onSuccess?.(data)
        message.success(data.deduplicated ? `已存在相同文件，code：${data.code}` : `上传成功：${data.code}`)
        void loadList()
      } catch (e) {
        onError?.(e as Error)
        message.error(apiErrorDetail(e) ?? '上传失败')
        console.error(e)
      }
    },
  }

  /** 有勾选时禁用行内操作，避免与「复制所选」语义冲突 */
  const rowActionsLocked = selectedRowKeys.length > 0

  const columns: ColumnsType<MediaListItem> = [
    {
      title: '预览',
      key: 'thumb',
      width: 88,
      render: (_, row) => {
        const url = mediaBinaryUrl(row.code)
        if (isImageMime(row.mime)) {
          return (
            <button
              type="button"
              onClick={() => setPreview({ code: row.code, mime: row.mime })}
              style={{
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: 'transparent',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <img alt="" src={url} style={{ width: 72, height: 48, objectFit: 'cover', display: 'block' }} />
            </button>
          )
        }
        if (isVideoMime(row.mime)) {
          return (
            <button
              type="button"
              onClick={() => setPreview({ code: row.code, mime: row.mime })}
              style={{
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                background: '#111',
                borderRadius: 4,
                width: 72,
                height: 48,
                color: '#fff',
                fontSize: 11,
              }}
            >
              视频
            </button>
          )
        }
        return <Text type="secondary">—</Text>
      },
    },
    {
      title: 'code',
      dataIndex: 'code',
      key: 'code',
      ellipsis: true,
      render: (c: string) => (
        <Text code copyable={{ text: c }}>
          {c}
        </Text>
      ),
    },
    { title: 'MIME', dataIndex: 'mime', key: 'mime', width: 140, ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 96,
      render: (s: number) => formatBytes(s),
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, render: (t) => t || '—' },
    { title: '原始文件名', dataIndex: 'original_name', key: 'original_name', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 200, ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      fixed: 'right',
      render: (_, row) => (
        <Space
          size="small"
          wrap
          title={
            rowActionsLocked
              ? '已勾选行时请使用上方「复制所选…」；取消勾选后可使用行内操作'
              : undefined
          }
        >
          <Button
            size="small"
            icon={<CopyOutlined />}
            disabled={rowActionsLocked}
            onClick={() => void copy(row.code, '已复制 code')}
          >
            code
          </Button>
          <Button
            size="small"
            disabled={rowActionsLocked}
            onClick={() => void copy(`![[MEDIA:${row.code}]]`, '已复制 wiki 占位符')}
          >
            占位符
          </Button>
          <Button
            size="small"
            icon={<LinkOutlined />}
            disabled={rowActionsLocked}
            href={rowActionsLocked ? undefined : mediaBinaryUrl(row.code)}
            target="_blank"
            rel="noreferrer"
          >
            打开
          </Button>
          <Button
            size="small"
            icon={<SearchOutlined />}
            disabled={rowActionsLocked}
            onClick={() => void openBackrefs(row.code)}
          >
            反向引用
          </Button>
        </Space>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="多媒体存储">
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="说明"
          description={
            <span>
              对应服务端 <code>data/media/</code>（manifest + <code>objects/</code>）。wiki 中写 Obsidian 风格{' '}
              <code>![[MEDIA:…]]</code> 或 HTML 注释 <code>{'<!-- media:… -->'}</code> 绑定资源。召回结果字段{' '}
              <code>merged_media</code> 与本表一致；请先执行「重建 wiki 反向索引」再使用「反向引用」。支持勾选后「导出所选为
              ZIP」（含 <code>pathy_media_export.json</code> 与二进制）；「从 ZIP 导入」可将包解回当前库，并可指定{' '}
              <code>media/objects/</code> 下的子目录归类落盘。
            </span>
          }
        />
        <Space wrap style={{ marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={() => void loadList()} loading={loading}>
            刷新列表
          </Button>
          <Button type="primary" ghost onClick={() => void onReindex()} loading={reindexBusy}>
            重建 wiki 反向索引
          </Button>
          <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
            从 ZIP 导入
          </Button>
        </Space>
        {list && (
          <Descriptions size="small" bordered column={2} style={{ marginBottom: 16 }}>
            <Descriptions.Item label="登记条数">{list.count}</Descriptions.Item>
            <Descriptions.Item label="登记总大小">{formatBytes(list.bytes_total)}</Descriptions.Item>
          </Descriptions>
        )}
        <Card type="inner" title="上传" size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form layout="inline">
              <Form.Item label="标题（可选）">
                <Input
                  placeholder="写入 manifest，便于识别"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{ width: 280 }}
                />
              </Form.Item>
            </Form>
            <Upload {...uploadProps} accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime,.mov">
              <Button icon={<UploadOutlined />}>选择文件并上传</Button>
            </Upload>
            <Paragraph type="secondary" style={{ marginBottom: 0, fontSize: 12 }}>
              允许：png / jpg / webp / gif / mp4 / webm / mov；大小与总配额由服务端配置。
            </Paragraph>
          </Space>
        </Card>
        <Space wrap style={{ marginBottom: 8 }}>
          <Text type="secondary">已选 {selectedRowKeys.length} 条</Text>
          <Button size="small" icon={<CopyOutlined />} disabled={selectedRowKeys.length === 0} onClick={copySelectedCodes}>
            复制所选 code
          </Button>
          <Button size="small" disabled={selectedRowKeys.length === 0} onClick={copySelectedPlaceholders}>
            复制所选占位符
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            disabled={selectedRowKeys.length === 0}
            loading={exportBusy}
            onClick={() => void exportSelectedZip()}
          >
            导出所选为 ZIP
          </Button>
        </Space>
        <Table<MediaListItem>
          rowKey="code"
          loading={loading}
          size="small"
          scroll={{ x: 1100 }}
          dataSource={list?.items ?? []}
          columns={columns}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            preserveSelectedRowKeys: true,
          }}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Drawer
        title={backrefCode ? `反向引用：${backrefCode}` : '反向引用'}
        placement="right"
        width={480}
        open={backrefOpen}
        onClose={() => {
          setBackrefOpen(false)
          setBackrefCode(null)
          setBackrefData(null)
        }}
      >
        {backrefLoading ? (
          <Text type="secondary">加载中…</Text>
        ) : backrefData ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {backrefData.message ? <Alert type="warning" message={backrefData.message} showIcon /> : null}
            <Table
              size="small"
              rowKey={(_, i) => String(i)}
              pagination={false}
              dataSource={backrefData.entries}
              columns={[
                { title: 'wiki 路径', dataIndex: 'wiki_path', key: 'wiki_path', ellipsis: true },
                { title: '标题路径', dataIndex: 'heading_path', key: 'heading_path', ellipsis: true },
              ]}
            />
          </Space>
        ) : null}
      </Drawer>

      <Modal
        open={importOpen}
        title="从导出 ZIP 导入"
        okText="开始导入"
        cancelText="取消"
        confirmLoading={importBusy}
        onCancel={() => {
          if (importBusy) return
          setImportOpen(false)
          setImportFile(null)
          setImportTargetDir('')
        }}
        onOk={() => void submitImportZip()}
        destroyOnClose
        width={560}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="仅支持本页「导出所选为 ZIP」生成的包（根目录含 pathy_media_export.json）。"
          />
          <Form layout="vertical">
            <Form.Item label="ZIP 文件" required>
              <Upload
                maxCount={1}
                accept=".zip,application/zip"
                beforeUpload={(f) => {
                  setImportFile(f)
                  return false
                }}
                onRemove={() => setImportFile(null)}
              >
                <Button>选择 zip</Button>
              </Upload>
              {importFile ? <Text type="secondary">{importFile.name}</Text> : null}
            </Form.Item>
            <Form.Item
              label="目标子目录（可选）"
              extra="相对 media/objects，如 project/handbook；留空则使用默认 objects/ab/cd/… 分层。每段仅字母数字下划线连字符。"
            >
              <Input
                placeholder="例如：batch2025"
                value={importTargetDir}
                onChange={(e) => setImportTargetDir(e.target.value)}
              />
            </Form.Item>
          </Form>
        </Space>
      </Modal>

      <Modal
        open={preview != null}
        footer={null}
        width={720}
        onCancel={() => setPreview(null)}
        title={preview ? `预览 · ${preview.code}` : '预览'}
        destroyOnClose
      >
        {preview &&
          (isImageMime(preview.mime) ? (
            <img
              alt=""
              src={mediaBinaryUrl(preview.code)}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain' }}
            />
          ) : isVideoMime(preview.mime) ? (
            <video
              controls
              style={{ width: '100%', maxHeight: '70vh' }}
              src={mediaBinaryUrl(preview.code)}
            >
              <track kind="captions" />
            </video>
          ) : (
            <Paragraph>不支持内联预览的 MIME：{preview.mime}，请使用「打开」在新标签页查看。</Paragraph>
          ))}
      </Modal>
    </Space>
  )
}
