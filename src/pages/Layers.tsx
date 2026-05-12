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
  TreeSelect,
  Typography,
  Upload,
} from 'antd'
import type { UploadProps } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { Key } from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiErrorDetail } from '../api/client'
import type {
  DataFolderTreeNode,
  DirEntry,
  FileContentResponse,
  LayerName,
  ListLayerResponse,
  PolishTextResponse,
  WikiEmbedResponse,
} from '../api/types'

type UploadCustomRequestOpt = Parameters<NonNullable<UploadProps['customRequest']>>[0]

const { Text } = Typography

/** 文件列表表体固定高度（px），超出在表内滚动、表头保持可见 */
const LAYERS_BROWSER_TABLE_SCROLL_Y = 600

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

/** 将「目录树中的目录前缀」与上传文件名组合为层内相对路径（与 /upload 的 path 一致） */
function joinUploadDirAndFileName(dirKey: string, fileName: string): string {
  const d = dirKey.replace(/^\/+|\/+$/g, '')
  return d ? `${d}/${fileName}` : fileName
}

function mapFolderNodeToTreeSelect(n: DataFolderTreeNode): { value: string; title: string; children?: ReturnType<typeof mapFolderNodeToTreeSelect>[] } {
  const value = n.path.replace(/\/$/, '')
  return {
    value,
    title: n.title,
    children: n.children.length ? n.children.map(mapFolderNodeToTreeSelect) : undefined,
  }
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
  const [folderTree, setFolderTree] = useState<DataFolderTreeNode | null>(null)
  const [folderTreeLoading, setFolderTreeLoading] = useState(false)
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

  const browseDirKey = useMemo(() => prefix.replace(/\/$/, ''), [prefix])

  const displayedEntries = useMemo(
    () => (layer === 'schema' ? entries : entries.filter((e) => !e.is_dir)),
    [entries, layer],
  )

  const loadFolderTree = useCallback(async () => {
    if (layer === 'schema') {
      setFolderTree(null)
      return
    }
    setFolderTreeLoading(true)
    try {
      const { data } = await api.get<DataFolderTreeNode>(`/api/v1/data-structure/tree/${layer}`)
      setFolderTree(data)
    } catch (e) {
      message.error('加载上传目录树失败')
      console.error(e)
      setFolderTree(null)
    } finally {
      setFolderTreeLoading(false)
    }
  }, [layer, message])

  useEffect(() => {
    void loadFolderTree()
  }, [loadFolderTree])

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

  const closeFileEditor = useCallback(() => {
    setFilePath(null)
    setContent('')
    setFileMeta(null)
  }, [])

  const enterDir = useCallback(
    (e: DirEntry) => {
      if (!e.is_dir) {
        const p = e.path.replace(/\/$/, '')
        void openFile(p)
        return
      }
      setPrefix(e.path)
      closeFileEditor()
    },
    [closeFileEditor, openFile],
  )

  const deleteEntry = useCallback(
    async (row: DirEntry) => {
      const p = entryApiPath(row)
      try {
        await api.delete('/api/v1/layers/' + layer + '/file', { params: { path: p } })
        message.success('已删除')
        if (filePath === p) {
          closeFileEditor()
        }
        void loadList()
      } catch (e) {
        message.error(apiErrorDetail(e) ?? '删除失败（若开启禁止删除 wiki，请用服务端配置或换层）')
        console.error(e)
      }
    },
    [closeFileEditor, filePath, layer, loadList, message],
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
            closeFileEditor()
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
  }, [closeFileEditor, filePath, layer, loadList, message, selectedRowKeys])

  const columns: ColumnsType<DirEntry> = useMemo(
    () => [
      {
        title: '名称',
        dataIndex: 'name',
        width: 110,
        render: (v: string, row) => {
          const label = `${v}${row.is_dir ? '/' : ''}`
          return (
            <Text ellipsis={{ tooltip: label }} style={{ maxWidth: 140, display: 'inline-block' }}>
              {label}
            </Text>
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
        width: 220,
        align: 'center',
        render: (_, row) => (
          <Space size={6} wrap>
            {row.is_dir ? (
              <Button type="link" size="small" style={{ padding: 0 }} onClick={() => enterDir(row)}>
                进入
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                style={{ padding: 0 }}
                onClick={() => void openFile(row.path.replace(/\/$/, ''))}
              >
                详情
              </Button>
            )}
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
    [deleteEntry, embeddingPath, enterDir, layer, loadList, message, openFile],
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

  const uploadTreeSelectData = useMemo(() => {
    if (!folderTree) return []
    return [mapFolderNodeToTreeSelect(folderTree)]
  }, [folderTree])

  const handleUpload = useCallback(
    async (opt: UploadCustomRequestOpt) => {
      const raw = opt.file as File
      const rel = joinUploadDirAndFileName(browseDirKey, raw.name)
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
        void loadList()
        void loadFolderTree()
      } catch (e) {
        opt.onError?.(e as Error)
        message.error(apiErrorDetail(e) ?? '上传失败')
        console.error(e)
      } finally {
        setUploading(false)
      }
    },
    [browseDirKey, layer, loadFolderTree, loadList, message],
  )

  const crumbs = useMemo(() => {
    const parts = prefix.split('/').filter(Boolean)
    const items: { title: string; onClick?: () => void }[] = [
      {
        title: '根',
        onClick: () => {
          setPrefix('')
          closeFileEditor()
        },
      },
    ]
    let acc = ''
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p
      const at = acc + '/'
      items.push({
        title: p,
        onClick: () => {
          setPrefix(at)
          closeFileEditor()
        },
      })
    }
    return items
  }, [closeFileEditor, prefix])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="使用流程"
        description={
          <ol style={{ margin: 0, paddingLeft: 20, marginBottom: 0 }}>
            <li>
              <strong>raw / wiki 层</strong>：卡片标题栏<strong>左侧</strong>选层与目录，<strong>右侧</strong>为 <strong>查询 / 上传</strong>（与下方面包屑、列表前缀一致）。点 <strong>查询</strong> 拉取列表。列表<strong>仅显示文件</strong>，子目录请用树或面包屑进入。正文超过 <strong>2500 字（Unicode 字符）</strong>时会<strong>自动拆成多个文件</strong>（如{' '}
              <code>笔记-1.md</code>、<code>笔记-2.md</code>）。在操作列点 <strong>详情</strong> 于<strong>弹窗</strong>中查看或编辑、保存；目录行点 <strong>进入</strong> 切换路径。
            </li>
            <li>
              <strong>schema 规范层</strong>：标题栏<strong>左侧</strong>切换层，<strong>右侧</strong> <strong>查询 / 创建</strong>；点创建在弹出框中编辑模板正文；可先 <strong>AI 润色</strong> 再保存到
              <code>schema/</code>。编译 / Lint 时会读入这些约定。
            </li>
            <li>
              侧栏 <strong>LLM 任务 → 编译任务</strong>：填写 raw 内 <code>input_paths</code> 与 wiki 内 <code>output_path</code>，将素材编译为 wiki
              条目并写入 <strong>wiki 编译层</strong>。需要已配置 API 密钥与模型。
            </li>
            <li>
              侧栏 <strong>LLM 任务 → 一致性报告</strong>：对编译结果做 Lint，检查链接、结构等。全程数据在服务器 <code>data/</code> 下。
            </li>
          </ol>
        }
      />
    <Row gutter={16} align="stretch">
      <Col xs={24} lg={24} style={{ display: 'flex', minWidth: 0 }}>
        <Card
          title={
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'nowrap',
                minWidth: 0,
              }}
            >
              <Select<LayerName>
                value={layer}
                size="middle"
                style={{ width: 130, flexShrink: 0 }}
                onChange={(v) => {
                  if (v !== 'schema') setSchemaModalOpen(false)
                  setLayer(v)
                  setPrefix('')
                  closeFileEditor()
                }}
                options={[
                  { value: 'raw', label: 'raw 原始层' },
                  { value: 'wiki', label: 'wiki 编译层' },
                  { value: 'schema', label: 'schema 规范层' },
                ]}
              />
              {layer !== 'schema' ? (
                <TreeSelect
                  size="middle"
                  style={{ width: 220, minWidth: 140, flexShrink: 1, maxWidth: '100%' }}
                  placeholder="目录（查询/上传）"
                  allowClear
                  showSearch
                  treeDefaultExpandAll
                  loading={folderTreeLoading}
                  disabled={uploading}
                  value={browseDirKey}
                  onChange={(v) => {
                    const key = typeof v === 'string' ? v : ''
                    setPrefix(key ? `${key}/` : '')
                    closeFileEditor()
                  }}
                  treeData={uploadTreeSelectData}
                  treeNodeFilterProp="title"
                />
              ) : null}
            </div>
          }
          style={{ flex: 1, width: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
          styles={{
            header: {
              paddingBlock: 14,
              paddingInline: 16,
              minHeight: 56,
              alignItems: 'center',
            },
            body: {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
          }}
          extra={
            layer === 'schema' ? (
              <Space size={10}>
                <Button type="primary" size="middle" onClick={() => { void loadList(); void loadFolderTree() }}>
                  查询
                </Button>
                <Button type="primary" icon={<FileAddOutlined />} size="middle" onClick={openSchemaCreate}>
                  创建
                </Button>
              </Space>
            ) : (
              <Space size={10}>
                <Button
                  type="primary"
                  size="middle"
                  onClick={() => {
                    void loadList()
                    void loadFolderTree()
                  }}
                >
                  查询
                </Button>
                <Upload
                  maxCount={1}
                  showUploadList={false}
                  customRequest={(opt) => void handleUpload(opt)}
                  disabled={uploading}
                >
                  <Button type="primary" icon={<UploadOutlined />} loading={uploading} size="middle">
                    上传
                  </Button>
                </Upload>
              </Space>
            )
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
            style={{ marginBottom: 12, flexShrink: 0 }}
          />
          {selectedRowKeys.length > 0 && (
            <Space wrap style={{ marginBottom: 12, flexShrink: 0 }}>
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
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Table<DirEntry>
              size="small"
              rowKey={(r) => r.path}
              loading={listLoading}
              columns={columns}
              dataSource={displayedEntries}
              pagination={false}
              scroll={{ x: 820, y: LAYERS_BROWSER_TABLE_SCROLL_Y }}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                preserveSelectedRowKeys: false,
              }}
            />
          </div>
        </Card>
      </Col>
    </Row>
      <Modal
        title={filePath ? `编辑：${filePath}` : '编辑'}
        open={filePath != null}
        onCancel={closeFileEditor}
        width={920}
        centered
        maskClosable={false}
        footer={
          <Space>
            <Button onClick={closeFileEditor}>关闭</Button>
            <Button type="primary" disabled={!filePath} loading={saving} onClick={() => void saveFile()}>
              保存
            </Button>
          </Space>
        }
      >
        {fileMeta ? (
          <Text type="secondary" style={{ display: 'block', marginBottom: 10 }}>
            UTF-8 · {fileMeta.size} 字节
          </Text>
        ) : null}
        <Input.TextArea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在列表操作列点击「详情」打开此弹窗进行编辑"
          style={{
            minHeight: 420,
            width: '100%',
            resize: 'vertical',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          }}
        />
      </Modal>
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
