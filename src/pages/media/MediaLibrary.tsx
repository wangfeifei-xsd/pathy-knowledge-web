import {
  CopyOutlined,
  DeleteOutlined,
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
  Popconfirm,
  Select,
  Space,
  Table,
  TreeSelect,
  Typography,
  Upload,
} from 'antd'
import type { ColumnsType, TableProps } from 'antd/es/table'
import type { UploadProps } from 'antd/es/upload/interface'

interface FolderTreeNode {
  value: string
  title: string
  children: FolderTreeNode[]
}
import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Key } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import { mediaBinaryUrl } from '../../api/mediaUrls'
import type {
  DataFolderTreeNode,
  MediaBackrefsResponse,
  MediaDeleteBatchResponse,
  MediaDeleteOneResponse,
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

/** 媒体内容寻址目录（aa/bb，code 前 4 个十六进制位）会成为目录树中的噪声节点，从选择器里隐藏 */
const SHA_DIR_RE = /^[0-9a-f]{2}$/i

const ROOT_FOLDER_VALUE = '__media_root__'

/** 把后端 DataFolderTreeNode 转成 antd TreeSelect 节点：
 *  - 层根节点（path==''）value = ROOT_FOLDER_VALUE，提示走默认 objects/aa/bb/…
 *  - 其它节点 value = 去掉尾部斜杠的相对路径（如 'objects'、'HSYJY'、'albums/2025'）
 *  - 过滤掉名字像 aa/bb 这种内容寻址前缀（避免界面被噪声淹没）
 */
function buildFolderTreeOption(n: DataFolderTreeNode): FolderTreeNode {
  const isRoot = n.path === ''
  const value = isRoot ? ROOT_FOLDER_VALUE : n.path.replace(/\/$/, '')
  const visibleChildren = n.children
    .filter((c) => !SHA_DIR_RE.test(c.title))
    .map(buildFolderTreeOption)
  return {
    value,
    title: isRoot ? `${n.title}（默认 objects/aa/bb/…）` : n.path.replace(/\/$/, ''),
    children: visibleChildren,
  }
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
  const [importTargetFolder, setImportTargetFolder] = useState<string>(ROOT_FOLDER_VALUE)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [batchDeleteBusy, setBatchDeleteBusy] = useState(false)
  const [folderTree, setFolderTree] = useState<DataFolderTreeNode | null>(null)
  const [folderFilter, setFolderFilter] = useState<string>('__all__')
  const [mediaTablePage, setMediaTablePage] = useState({ current: 1, pageSize: 20 })

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

  const loadFolderTree = useCallback(async () => {
    try {
      const { data } = await api.get<DataFolderTreeNode>('/api/v1/data-structure/tree/media', {
        params: { max_depth: 3 },
      })
      setFolderTree(data)
    } catch (e) {
      console.error('加载 media 目录树失败', e)
      setFolderTree(null)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    void loadFolderTree()
  }, [loadFolderTree])

  const folderTreeData = useMemo<FolderTreeNode[]>(
    () => (folderTree ? [buildFolderTreeOption(folderTree)] : []),
    [folderTree],
  )

  /** 列表中实际出现过的 folder 取值集合（用于上方过滤下拉） */
  const folderFilterOptions = useMemo(() => {
    const items = list?.items ?? []
    const counts = new Map<string, number>()
    for (const it of items) {
      const key = it.folder ?? ''
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const opts: { value: string; label: string }[] = [
      { value: '__all__', label: `全部（${items.length}）` },
    ]
    Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([k, n]) => {
        opts.push({ value: k || '__empty__', label: `${k || '(未归类)'}（${n}）` })
      })
    return opts
  }, [list])

  const filteredItems = useMemo<MediaListItem[]>(() => {
    const items = list?.items ?? []
    if (folderFilter === '__all__') return items
    if (folderFilter === '__empty__') return items.filter((it) => !it.folder)
    return items.filter((it) => it.folder === folderFilter)
  }, [list, folderFilter])

  const mediaTotalRows = filteredItems.length
  const mediaMaxPage = Math.max(1, Math.ceil(mediaTotalRows / mediaTablePage.pageSize) || 1)

  useEffect(() => {
    if (mediaTablePage.current > mediaMaxPage) {
      setMediaTablePage((p) => ({ ...p, current: mediaMaxPage }))
    }
  }, [mediaMaxPage, mediaTablePage.current])

  const onMediaTableChange: TableProps<MediaListItem>['onChange'] = (pag) => {
    const nextSize = pag.pageSize ?? mediaTablePage.pageSize
    const sizeChanged = nextSize !== mediaTablePage.pageSize
    setMediaTablePage({
      current: sizeChanged ? 1 : (pag.current ?? 1),
      pageSize: nextSize,
    })
  }

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
      const folderVal = importTargetFolder === ROOT_FOLDER_VALUE ? '' : importTargetFolder.trim()
      if (folderVal) fd.append('target_folder', folderVal)
      const { data } = await api.post<MediaImportZipResponse>('/api/v1/media/import-zip', fd)
      message.success(data.message)
      if (data.warning) message.warning(data.warning)
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
      setImportTargetFolder(ROOT_FOLDER_VALUE)
      void loadList()
      void loadFolderTree()
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '导入失败')
      console.error(e)
    } finally {
      setImportBusy(false)
    }
  }

  const deleteOneMedia = async (code: string) => {
    try {
      const { data } = await api.delete<MediaDeleteOneResponse>(`/api/v1/media/${encodeURIComponent(code)}`)
      message.success(data.message)
      setSelectedRowKeys((prev) => prev.filter((k) => String(k) !== code))
      void loadList()
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '删除失败')
      console.error(e)
    }
  }

  const confirmBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先勾选要删除的资源')
      return
    }
    const n = selectedRowKeys.length
    Modal.confirm({
      title: `确定删除选中的 ${n} 条媒体？`,
      content:
        '将移除 manifest 登记；若无其他条目共用磁盘路径则删除对象文件，并清除该 code 在反向索引中的记录。wiki 正文中的占位符不会自动删除，请自行清理。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setBatchDeleteBusy(true)
        try {
          const { data } = await api.post<MediaDeleteBatchResponse>('/api/v1/media/batch-delete', {
            codes: selectedRowKeys.map(String),
          })
          message.success(data.message)
          const deleted = new Set(data.results.filter((r) => r.status === 'deleted').map((r) => r.code))
          setSelectedRowKeys((prev) => prev.filter((k) => !deleted.has(String(k))))
          const others = data.results.filter((r) => r.status !== 'deleted')
          if (others.length > 0) {
            Modal.warning({
              title: '部分条目未删除',
              width: 560,
              content: (
                <Table
                  size="small"
                  pagination={{ pageSize: 8 }}
                  rowKey={(_, i) => String(i)}
                  dataSource={others}
                  columns={[
                    { title: 'code', dataIndex: 'code', key: 'c', ellipsis: true },
                    { title: '状态', dataIndex: 'status', key: 's', width: 120 },
                    { title: '说明', dataIndex: 'detail', key: 'd', ellipsis: true },
                  ]}
                />
              ),
            })
          }
          void loadList()
        } catch (e) {
          message.error(apiErrorDetail(e) ?? '批量删除失败')
          console.error(e)
        } finally {
          setBatchDeleteBusy(false)
        }
      },
    })
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
    {
      title: '菜单',
      dataIndex: 'folder',
      key: 'folder',
      width: 160,
      ellipsis: true,
      render: (f: string) => (f ? <Text code>{f}</Text> : <Text type="secondary">—</Text>),
    },
    { title: '标题', dataIndex: 'title', key: 'title', ellipsis: true, render: (t) => t || '—' },
    { title: '原始文件名', dataIndex: 'original_name', key: 'original_name', ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 200, ellipsis: true },
    {
      title: '操作',
      key: 'actions',
      width: 360,
      fixed: 'right',
      render: (_, row) => (
        <Space
          size="small"
          wrap
          title={
            rowActionsLocked
              ? '已勾选行时请使用上方「复制所选…」「批量删除」等；取消勾选后可使用行内操作'
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
          <Popconfirm
            title="确定删除该媒体？"
            description="移除登记；无其他条目共用文件时删除对象。wiki 占位符需自行清理。"
            okText="删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => void deleteOneMedia(row.code)}
          >
            <Button size="small" danger type="primary" ghost icon={<DeleteOutlined />} disabled={rowActionsLocked}>
              删除
            </Button>
          </Popconfirm>
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
              <code>media/objects/</code> 下的子目录归类落盘。支持单行或勾选后批量删除（manifest + 条件允许时删对象文件）。
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
          <Text type="secondary">菜单筛选</Text>
          <Select
            size="small"
            style={{ minWidth: 220 }}
            value={folderFilter}
            onChange={(v) => {
              setFolderFilter(v)
              setMediaTablePage((p) => ({ ...p, current: 1 }))
            }}
            options={folderFilterOptions}
            showSearch
            optionFilterProp="label"
          />
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
          <Button
            danger
            size="small"
            icon={<DeleteOutlined />}
            disabled={selectedRowKeys.length === 0}
            loading={batchDeleteBusy}
            onClick={() => confirmBatchDelete()}
          >
            批量删除
          </Button>
        </Space>
        <Table<MediaListItem>
          rowKey="code"
          loading={loading}
          size="small"
          scroll={{ x: 1340 }}
          dataSource={filteredItems}
          columns={columns}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
            preserveSelectedRowKeys: true,
          }}
          pagination={{
            current: mediaTablePage.current,
            pageSize: mediaTablePage.pageSize,
            total: mediaTotalRows,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            showTotal: (t) => `共 ${t} 条`,
          }}
          onChange={onMediaTableChange}
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
          setImportTargetFolder(ROOT_FOLDER_VALUE)
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
              label="目标菜单（media/ 下子目录）"
              extra={
                <span>
                  从已存在的 <Text code>media/</Text> 子目录中选；选择「层根目录」走默认 <Text code>objects/aa/bb/…</Text>{' '}
                  分层落盘。若想新建一个菜单，请先到「<Text strong>存储结构</Text>」页在 media 层根下新增子目录后回来选。
                </span>
              }
            >
              <TreeSelect
                value={importTargetFolder}
                onChange={(v) => setImportTargetFolder(v ?? ROOT_FOLDER_VALUE)}
                treeData={folderTreeData}
                treeDefaultExpandAll
                showSearch
                treeNodeFilterProp="title"
                style={{ width: '100%' }}
                placeholder="选择目标菜单"
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
