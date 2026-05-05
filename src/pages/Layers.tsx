import { FileAddOutlined, UploadOutlined } from '@ant-design/icons'
import {
  Alert,
  App,
  Breadcrumb,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from 'antd'
import type { UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Key } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiErrorDetail } from '../api/client'
import type {
  DirEntry,
  FileContentResponse,
  LayerName,
  ListLayerResponse,
  PolishTextResponse,
  WikiEmbedResponse,
} from '../api/types'

type UploadCustomRequestOpt = Parameters<NonNullable<UploadProps['customRequest']>>[0]

const { Text } = Typography

function entryApiPath(row: DirEntry): string {
  return row.path.replace(/\/$/, '')
}

/** 每个文件最多 Unicode 字符数（码点），超出则拆成 base-1、base-2 … */
const UPLOAD_CHUNK_CHARS = 2500

/** 按字符数切分；`for...of` 按 Unicode 码点迭代，避免拆开 emoji 等 */
function splitTextByMaxChars(text: string, maxChars: number): string[] {
  const chunks: string[] = []
  let buf = ''
  let n = 0
  for (const ch of text) {
    if (n >= maxChars) {
      chunks.push(buf)
      buf = ''
      n = 0
    }
    buf += ch
    n++
  }
  if (buf.length) chunks.push(buf)
  return chunks.length ? chunks : ['']
}

/** 多段时路径为 base-1.ext、base-2.ext；单段保持原 rel */
function expandUploadPaths(rel: string, partCount: number): string[] {
  if (partCount <= 1) return [rel]
  const lastSlash = rel.lastIndexOf('/')
  const dir = lastSlash >= 0 ? rel.slice(0, lastSlash + 1) : ''
  const file = lastSlash >= 0 ? rel.slice(lastSlash + 1) : rel
  const dot = file.lastIndexOf('.')
  const hasExt = dot > 0 && dot < file.length - 1
  const base = hasExt ? file.slice(0, dot) : file
  const ext = hasExt ? file.slice(dot) : ''
  return Array.from({ length: partCount }, (_, idx) => `${dir}${base}-${idx + 1}${ext}`)
}

const SCHEMA_CREATE_TEMPLATE = `# 知识库维护约定（AGENTS）

本文供编译 / Lint 等任务引用，请按团队实际情况修改。

## 目录结构

- **raw/**：原始素材（笔记、剪藏等）
- **wiki/**：编译后的结构化条目
- **schema/**：规范与本文件

## 命名与格式

- Markdown，文件名建议小写；常用约定文件名：\`AGENTS.md\`
- （在此补充你们的命名规则）

## 禁止事项

- （例如：禁止在正文存放明文密钥、禁止删除他人条目等）

## 写作与链接风格

- （在此补充术语、内部链接格式等）
`

function defaultSchemaRelativePath(prefixDir: string): string {
  const base = prefixDir.replace(/\/$/, '')
  return base ? `${base}/AGENTS.md` : 'AGENTS.md'
}

export function Layers() {
  const { message } = App.useApp()
  const [layer, setLayer] = useState<LayerName>('raw')
  const [prefix, setPrefix] = useState('')
  const [entries, setEntries] = useState<DirEntry[]>([])
  const [listLoading, setListLoading] = useState(false)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [fileMeta, setFileMeta] = useState<FileContentResponse | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadPath, setUploadPath] = useState('')
  const [uploading, setUploading] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([])
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [embeddingPath, setEmbeddingPath] = useState<string | null>(null)

  const [schemaModalOpen, setSchemaModalOpen] = useState(false)
  const [schemaRelPath, setSchemaRelPath] = useState('AGENTS.md')
  const [schemaDraft, setSchemaDraft] = useState(SCHEMA_CREATE_TEMPLATE)
  const [polishHint, setPolishHint] = useState('')
  const [polishing, setPolishing] = useState(false)
  const [savingSchema, setSavingSchema] = useState(false)

  const loadList = useCallback(async () => {
    setListLoading(true)
    try {
      const { data } = await api.get<ListLayerResponse>('/api/v1/layers/' + layer + '/entries', {
        params: { prefix: prefix || undefined },
      })
      setEntries(data.entries)
    } catch (e) {
      message.error('列举目录失败')
      console.error(e)
    } finally {
      setListLoading(false)
    }
  }, [layer, message, prefix])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    setSelectedRowKeys([])
  }, [layer, prefix])

  const openFile = useCallback(
    async (path: string) => {
      try {
        const { data } = await api.get<FileContentResponse>('/api/v1/layers/' + layer + '/file', {
          params: { path },
        })
        setFilePath(path)
        setContent(data.content)
        setFileMeta(data)
      } catch (e) {
        message.error('读取文件失败')
        console.error(e)
      }
    },
    [layer, message],
  )

  const saveFile = useCallback(async () => {
    if (!filePath) return
    setSaving(true)
    try {
      const { data } = await api.put<FileContentResponse>('/api/v1/layers/' + layer + '/file', { content }, { params: { path: filePath } })
      setFileMeta(data)
      message.success('已保存')
      void loadList()
    } catch (e) {
      message.error('保存失败')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }, [content, filePath, layer, loadList, message])

  const enterDir = useCallback(
    (e: DirEntry) => {
      if (!e.is_dir) {
        const p = e.path.replace(/\/$/, '')
        void openFile(p)
        return
      }
      setPrefix(e.path)
      setFilePath(null)
      setContent('')
      setFileMeta(null)
    },
    [openFile],
  )

  const deleteEntry = useCallback(
    async (row: DirEntry) => {
      const p = entryApiPath(row)
      try {
        await api.delete('/api/v1/layers/' + layer + '/file', { params: { path: p } })
        message.success('已删除')
        if (filePath === p) {
          setFilePath(null)
          setContent('')
          setFileMeta(null)
        }
        void loadList()
      } catch (e) {
        message.error(apiErrorDetail(e) ?? '删除失败（若开启禁止删除 wiki，请用服务端配置或换层）')
        console.error(e)
      }
    },
    [filePath, layer, loadList, message],
  )

  const deleteSelectedEntries = useCallback(async () => {
    if (selectedRowKeys.length === 0) return
    setBatchDeleting(true)
    let ok = 0
    let failed = 0
    try {
      for (const key of selectedRowKeys) {
        const p = String(key).replace(/\/$/, '')
        try {
          await api.delete('/api/v1/layers/' + layer + '/file', { params: { path: p } })
          ok++
          if (filePath === p) {
            setFilePath(null)
            setContent('')
            setFileMeta(null)
          }
        } catch {
          failed++
        }
      }
      if (ok && !failed) message.success(`已删除 ${ok} 项`)
      else if (ok && failed) message.warning(`已删除 ${ok} 项，${failed} 项失败`)
      else message.error('删除失败（若开启禁止删除 wiki，请用服务端配置或换层）')
      setSelectedRowKeys([])
      void loadList()
    } finally {
      setBatchDeleting(false)
    }
  }, [filePath, layer, loadList, message, selectedRowKeys])

  const columns: ColumnsType<DirEntry> = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        width: 110,
        render: (v: string, row) => {
          const label = `${v}${row.is_dir ? '/' : ''}`
          return (
            <Button
              type="link"
              onClick={() => enterDir(row)}
              style={{ padding: 0, height: 'auto', maxWidth: '100%' }}
            >
              <Text ellipsis={{ tooltip: label }} style={{ maxWidth: 90, display: 'inline-block' }}>
                {label}
              </Text>
            </Button>
          )
        },
      },
      {
        title: '类型',
        width: 80,
        render: (_, row) => (row.is_dir ? '目录' : '文件'),
      },
      {
        title: '大小',
        width: 100,
        dataIndex: 'size',
        render: (s: number | null) => (s == null ? '—' : s),
      },
      {
        title: '嵌入状态',
        width: 100,
        render: (_, row) => {
          if (layer !== 'wiki' || row.is_dir) return '—'
          if (row.embedding_status === 'embedded') return <Tag color="success">已嵌入</Tag>
          if (row.embedding_status === 'stale') return <Tag color="warning">需重嵌入</Tag>
          return <Tag>未嵌入</Tag>
        },
      },
      {
        title: '操作',
        width: 150,
        align: 'center',
        render: (_, row) => (
          <Space size={6}>
            {layer === 'wiki' && !row.is_dir ? (
              <Button
                type="link"
                size="small"
                loading={embeddingPath === row.path}
                disabled={row.embedding_status === 'embedded'}
                onClick={async () => {
                  try {
                    setEmbeddingPath(row.path)
                    const p = row.path.replace(/\/$/, '')
                    const { data } = await api.post<WikiEmbedResponse>('/api/v1/wiki/embed', { path: p })
                    message.success(`已嵌入 ${data.chunk_count} 个 chunk`)
                    void loadList()
                  } catch (e) {
                    message.error(apiErrorDetail(e) ?? '嵌入失败')
                  } finally {
                    setEmbeddingPath(null)
                  }
                }}
                style={{ padding: 0 }}
              >
                嵌入
              </Button>
            ) : null}
            <Popconfirm
              title={row.is_dir ? '删除该目录？' : '删除该文件？'}
              description={<span style={{ wordBreak: 'break-all' }}>{entryApiPath(row)}</span>}
              onConfirm={() => void deleteEntry(row)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="link" danger size="small" style={{ padding: 0 }}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [deleteEntry, embeddingPath, enterDir, layer, loadList, message],
  )

  const openSchemaCreate = useCallback(() => {
    setSchemaRelPath(defaultSchemaRelativePath(prefix))
    setSchemaDraft(SCHEMA_CREATE_TEMPLATE)
    setPolishHint('')
    setSchemaModalOpen(true)
  }, [prefix])

  const polishSchemaDraft = useCallback(async () => {
    if (!schemaDraft.trim()) {
      message.warning('请先填写正文')
      return
    }
    setPolishing(true)
    try {
      const { data } = await api.post<PolishTextResponse>('/api/v1/tasks/polish-text', {
        content: schemaDraft,
        instruction: polishHint.trim() || undefined,
      })
      setSchemaDraft(data.content)
      message.success(`已润色（${data.model}），请确认后保存`)
    } catch (e) {
      message.error('润色失败，请检查模型与 API 密钥')
      console.error(e)
    } finally {
      setPolishing(false)
    }
  }, [message, polishHint, schemaDraft])

  const saveSchemaCreate = useCallback(async () => {
    const rel = schemaRelPath.trim() || 'AGENTS.md'
    setSavingSchema(true)
    try {
      await api.put<FileContentResponse>(
        '/api/v1/layers/schema/file',
        { content: schemaDraft },
        { params: { path: rel } },
      )
      message.success(`已保存：schema/${rel}`)
      setSchemaModalOpen(false)
      void loadList()
    } catch (e) {
      message.error('保存失败')
      console.error(e)
    } finally {
      setSavingSchema(false)
    }
  }, [loadList, message, schemaDraft, schemaRelPath])

  const suggestUploadPath = useCallback(
    (fileName: string) => {
      const base = prefix.replace(/\/$/, '')
      return base ? `${base}/${fileName}` : fileName
    },
    [prefix],
  )

  const handleUpload = useCallback(
    async (opt: UploadCustomRequestOpt) => {
      const raw = opt.file as File
      const rel = uploadPath.trim() || suggestUploadPath(raw.name)
      setUploading(true)
      try {
        const text = await raw.text()
        const charCount = [...text].length
        const parts =
          charCount <= UPLOAD_CHUNK_CHARS ? [text] : splitTextByMaxChars(text, UPLOAD_CHUNK_CHARS)
        const paths = expandUploadPaths(rel, parts.length)
        let lastData: FileContentResponse | null = null
        const uploadedPaths: string[] = []
        for (let i = 0; i < parts.length; i++) {
          const blob = new Blob([parts[i]], { type: 'text/plain;charset=utf-8' })
          const fd = new FormData()
          const partName = paths[i].split('/').pop() || 'part.txt'
          fd.append('file', blob, partName)
          fd.append('path', paths[i])
          const { data } = await api.post<FileContentResponse>(`/api/v1/layers/${layer}/upload`, fd)
          lastData = data
          uploadedPaths.push(data.path)
        }
        opt.onSuccess?.(lastData!, new XMLHttpRequest())
        message.success(
          parts.length > 1
            ? `已上传 ${parts.length} 个文件（每 ${UPLOAD_CHUNK_CHARS} 字一段）：${uploadedPaths.join('、')}`
            : `已上传：${uploadedPaths[0]}`,
        )
        setUploadPath('')
        void loadList()
      } catch (e) {
        opt.onError?.(e as Error)
        message.error(apiErrorDetail(e) ?? '上传失败')
        console.error(e)
      } finally {
        setUploading(false)
      }
    },
    [layer, loadList, message, suggestUploadPath, uploadPath],
  )

  const crumbs = useMemo(() => {
    const parts = prefix.split('/').filter(Boolean)
    const items: { title: string; onClick?: () => void }[] = [{ title: '根', onClick: () => setPrefix('') }]
    let acc = ''
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p
      const at = acc + '/'
      items.push({
        title: p,
        onClick: () => {
          setPrefix(at)
          setFilePath(null)
        },
      })
    }
    return items
  }, [prefix])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="使用流程（与需求方案一致）"
        description={
          <ol style={{ margin: 0, paddingLeft: 20, marginBottom: 0 }}>
            <li>
              <strong>raw 原始层</strong>：放入未编译的素材（笔记、剪藏、Markdown）。在「浏览」卡片右上角使用 <strong>上传</strong>（默认保存到当前面包屑目录 + 原文件名）；正文超过 <strong>2500 字（Unicode 字符）</strong>时会<strong>自动拆成多个文件</strong>（如{' '}
              <code>笔记-1.md</code>、<code>笔记-2.md</code>）。也可点开 <code>*.md</code> 编辑保存；或通过「API 文档」、直接向服务器 <code>data/raw</code> 拷贝文件。
            </li>
            <li>
              <strong>schema 规范层</strong>（建议）：切换到本层后点右上角 <strong>创建</strong>，在弹出框中编辑模板正文；可先 <strong>AI 润色</strong> 再保存到
              <code>schema/</code>。编译 / Lint 会读入这些约定。
            </li>
            <li>
              打开侧栏 <strong>LLM 任务 → 编译任务</strong>：填写 raw 内 <code>input_paths</code> 与 wiki 内 <code>output_path</code>，把素材整理为 wiki
              型条目并写入 <strong>wiki 编译层</strong>。需要已配置 API 密钥与模型。
            </li>
            <li>
              可选：侧栏 <strong>LLM 任务 → 一致性报告</strong> 对编译结果做 Lint，检查链接、结构等。全程数据在服务器 <code>data/</code> 下，本页负责浏览与轻量编辑。
            </li>
          </ol>
        }
      />
    <Row gutter={16}>
      <Col xs={24} lg={10}>
        <Card
          title="浏览"
          styles={{
            header: {
              paddingBlock: 14,
              paddingInline: 16,
              minHeight: 56,
              alignItems: 'center',
            },
          }}
          extra={
            <Space
              wrap
              size={12}
              align="center"
              style={{ rowGap: 10, paddingBlock: 2 }}
            >
              <Select<LayerName>
                value={layer}
                size="middle"
                style={{ width: 130 }}
                onChange={(v) => {
                  if (v !== 'schema') setSchemaModalOpen(false)
                  setLayer(v)
                  setPrefix('')
                  setFilePath(null)
                }}
                options={[
                  { value: 'raw', label: 'raw 原始层' },
                  { value: 'wiki', label: 'wiki 编译层' },
                  { value: 'schema', label: 'schema 规范层' },
                ]}
              />
              <Button size="middle" onClick={() => void loadList()}>
                刷新
              </Button>
              {layer === 'schema' ? (
                <Button type="primary" icon={<FileAddOutlined />} size="middle" onClick={openSchemaCreate}>
                  创建
                </Button>
              ) : (
                <>
                  <Input
                    size="middle"
                    style={{ width: 208 }}
                    placeholder="上传路径（可选）"
                    value={uploadPath}
                    onChange={(e) => setUploadPath(e.target.value)}
                    allowClear
                  />
                  <Upload
                    maxCount={1}
                    showUploadList={false}
                    customRequest={(opt) => void handleUpload(opt)}
                    disabled={uploading}
                  >
                    <Button
                      type="primary"
                      icon={<UploadOutlined />}
                      loading={uploading}
                      size="middle"
                    >
                      上传
                    </Button>
                  </Upload>
                </>
              )}
            </Space>
          }
        >
          <Breadcrumb
            items={crumbs.map((c) => ({
              title: (
                <a
                  onClick={(e) => {
                    e.preventDefault()
                    c.onClick?.()
                  }}
                >
                  {c.title}
                </a>
              ),
            }))}
            style={{ marginBottom: 12 }}
          />
          {selectedRowKeys.length > 0 && (
            <Space wrap style={{ marginBottom: 12 }}>
              <Popconfirm
                title={`删除选中的 ${selectedRowKeys.length} 项？`}
                description="删除后不可恢复（目录将递归删除）"
                okText="删除"
                cancelText="取消"
                okButtonProps={{ danger: true }}
                onConfirm={() => void deleteSelectedEntries()}
              >
                <Button danger loading={batchDeleting}>
                  删除选中（{selectedRowKeys.length}）
                </Button>
              </Popconfirm>
              <Button disabled={batchDeleting} onClick={() => setSelectedRowKeys([])}>
                取消选择
              </Button>
            </Space>
          )}
          <Table<DirEntry>
            size="small"
            rowKey={(r) => r.path}
            loading={listLoading}
            columns={columns}
            dataSource={entries}
            pagination={false}
            scroll={{ x: 760 }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              preserveSelectedRowKeys: false,
            }}
          />
        </Card>
      </Col>
      <Col xs={24} lg={14}>
        <Card
          title={filePath ? `编辑：${filePath}` : '未选择文件'}
          extra={
            <Button type="primary" disabled={!filePath} loading={saving} onClick={() => void saveFile()}>
              保存
            </Button>
          }
        >
          {fileMeta && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
              UTF-8 · {fileMeta.size} 字节
            </Text>
          )}
          <Input.TextArea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={22}
            placeholder="选择左侧文件进行查看或编辑"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
          />
        </Card>
      </Col>
    </Row>
      <Modal
        title="创建规范文件（schema）"
        open={schemaModalOpen}
        onCancel={() => setSchemaModalOpen(false)}
        width={760}
        footer={
          <Space wrap>
            <Button onClick={() => setSchemaModalOpen(false)}>取消</Button>
            <Button loading={polishing} onClick={() => void polishSchemaDraft()}>
              AI 润色
            </Button>
            <Button type="primary" loading={savingSchema} onClick={() => void saveSchemaCreate()}>
              保存到 schema
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              保存路径（相对 schema 层）
            </Text>
            <Input
              value={schemaRelPath}
              onChange={(e) => setSchemaRelPath(e.target.value)}
              placeholder="例如 AGENTS.md 或 notes/rule.md"
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              润色说明（可选，仅「AI 润色」时使用）
            </Text>
            <Input.TextArea
              rows={2}
              value={polishHint}
              onChange={(e) => setPolishHint(e.target.value)}
              placeholder="例如：语气正式一些；突出安全与保密条款……"
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 6 }}>
              正文（已预填模板，可直接编辑或润色后保存）
            </Text>
            <Input.TextArea
              rows={18}
              value={schemaDraft}
              onChange={(e) => setSchemaDraft(e.target.value)}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  )
}
