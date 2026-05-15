import { App, Alert, Button, Card, Input, Modal, Popconfirm, Space, Spin, Tabs, Tree, Typography } from 'antd'
import type { DataNode } from 'antd/es/tree'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, apiErrorDetail } from '../api/client'
import type {
  DataFolderTreeNode,
  DataStructureFolderCreateRequest,
  DataStructureFolderRenameRequest,
  LayerName,
} from '../api/types'

const { Text, Paragraph } = Typography

const LAYER_TAB: { key: LayerName; label: string }[] = [
  { key: 'raw', label: 'raw' },
  { key: 'wiki', label: 'wiki' },
  { key: 'schema', label: 'schema' },
  { key: 'media', label: 'media' },
]

const ROOT_TREE_KEY = '__root__'

function toTreeData(n: DataFolderTreeNode): DataNode {
  const key = n.path === '' ? ROOT_TREE_KEY : n.path
  return {
    key,
    title: n.title,
    children: n.children.map(toTreeData),
  }
}

function treeKeyToPath(key: string): string {
  return key === ROOT_TREE_KEY ? '' : key
}

export function StorageStructure() {
  const { message } = App.useApp()
  const [tab, setTab] = useState<LayerName>('raw')
  const [treeRoot, setTreeRoot] = useState<DataFolderTreeNode | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined)

  const selectedPath = useMemo(
    () => (selectedKey == null ? undefined : treeKeyToPath(selectedKey)),
    [selectedKey],
  )

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get<DataFolderTreeNode>(`/api/v1/data-structure/tree/${tab}`)
      setTreeRoot(data)
      setSelectedKey(undefined)
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '加载目录树失败')
      console.error(e)
      setTreeRoot(null)
    } finally {
      setLoading(false)
    }
  }, [message, tab])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  const treeData = useMemo(() => (treeRoot ? [toTreeData(treeRoot)] : []), [treeRoot])

  const [addOpen, setAddOpen] = useState(false)
  const [addName, setAddName] = useState('')
  const [addSubmitting, setAddSubmitting] = useState(false)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTo, setRenameTo] = useState('')
  const [renameSubmitting, setRenameSubmitting] = useState(false)

  const submitAdd = useCallback(async () => {
    const name = addName.trim()
    if (!name) {
      message.warning('请输入目录名')
      return
    }
    const body: DataStructureFolderCreateRequest = { layer: tab, name }
    setAddSubmitting(true)
    try {
      await api.post('/api/v1/data-structure/folders', body)
      message.success(`已创建：${tab}/${name}/`)
      setAddOpen(false)
      setAddName('')
      void loadTree()
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '创建失败')
      console.error(e)
    } finally {
      setAddSubmitting(false)
    }
  }, [addName, loadTree, message, tab])

  const submitRename = useCallback(async () => {
    if (selectedPath == null || selectedPath === '') {
      message.warning('请选择要重命名的子目录（不能选层根）')
      return
    }
    const newName = renameTo.trim()
    if (!newName) {
      message.warning('请输入新名称')
      return
    }
    const body: DataStructureFolderRenameRequest = {
      layer: tab,
      path: selectedPath,
      new_name: newName,
    }
    setRenameSubmitting(true)
    try {
      await api.patch('/api/v1/data-structure/folders/rename', body)
      message.success('已重命名')
      setRenameOpen(false)
      setRenameTo('')
      void loadTree()
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '重命名失败（仅空目录可改名）')
      console.error(e)
    } finally {
      setRenameSubmitting(false)
    }
  }, [loadTree, message, renameTo, selectedPath, tab])

  const submitDelete = useCallback(async () => {
    if (selectedPath == null || selectedPath === '') {
      message.warning('不能删除层根')
      return
    }
    try {
      await api.delete('/api/v1/data-structure/folders', {
        params: { layer: tab, path: selectedPath },
      })
      message.success('已删除')
      void loadTree()
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '删除失败（仅空目录可删；wiki 若开启禁止删除则受限；media 勿删 objects 与 manifest）')
      console.error(e)
    }
  }, [loadTree, message, selectedPath, tab])

  const openRename = useCallback(() => {
    if (!selectedPath) {
      message.warning('请先选择目录')
      return
    }
    if (selectedPath === '') {
      message.warning('层根不可重命名')
      return
    }
    const seg = selectedPath.replace(/\/$/, '').split('/').pop() ?? ''
    setRenameTo(seg)
    setRenameOpen(true)
  }, [message, selectedPath])

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        message="存储结构"
        description={
          <Paragraph style={{ marginBottom: 0 }}>
            与服务器 <Text code>data/</Text> 下 <Text code>raw</Text>、<Text code>wiki</Text>、<Text code>schema</Text>、
            <Text code>media</Text> 目录对应。<strong>新增</strong>仅允许在<strong>各层根下再挂一层</strong>子目录（例如{' '}
            <Text code>raw/reef</Text>、<Text code>wiki/reef</Text>、<Text code>media/albums</Text>）。<strong>重命名</strong>与
            <strong>删除</strong>仅当该目录<strong>为空</strong>（无文件、无子目录）时允许。
            <Text code>media</Text> 层内文件与 manifest 请用侧栏 <strong>多媒体存储</strong> 或 <Text code>/api/v1/media</Text>{' '}
            维护；本页仅维护其<strong>空子目录</strong>结构（勿删 <Text code>objects/</Text> 或 <Text code>manifest.json</Text>）。
          </Paragraph>
        }
      />
      <Card>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as LayerName)}
          items={LAYER_TAB.map((t) => ({
            key: t.key,
            label: t.label,
            children: (
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                <Space wrap>
                  <Button onClick={() => void loadTree()} loading={loading}>
                    刷新
                  </Button>
                  <Button type="primary" onClick={() => setAddOpen(true)}>
                    新增子目录
                  </Button>
                  <Button onClick={openRename} disabled={!selectedPath || selectedPath === ''}>
                    重命名所选
                  </Button>
                  <Popconfirm
                    title="删除该空目录？"
                    description={selectedPath || '未选择'}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    disabled={!selectedPath || selectedPath === ''}
                    onConfirm={() => void submitDelete()}
                  >
                    <Button danger disabled={!selectedPath || selectedPath === ''}>
                      删除所选
                    </Button>
                  </Popconfirm>
                </Space>
                <div style={{ minHeight: 360, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
                  <Spin spinning={loading}>
                    <Tree
                      showLine
                      blockNode
                      selectable
                      selectedKeys={selectedKey != null ? [selectedKey] : []}
                      onSelect={(keys) => {
                        const k = keys[0]
                        setSelectedKey(k == null ? undefined : String(k))
                      }}
                      treeData={treeData}
                    />
                  </Spin>
                </div>
              </Space>
            ),
          }))}
        />
      </Card>

      <Modal
        title={`在 ${tab} 层根下新增子目录`}
        open={addOpen}
        onCancel={() => setAddOpen(false)}
        okText="创建"
        cancelText="取消"
        confirmLoading={addSubmitting}
        onOk={() => void submitAdd()}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          仅单段名称，建议不要中文
        </Text>
        <Input
          placeholder="目录名"
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onPressEnter={() => void submitAdd()}
        />
      </Modal>

      <Modal
        title="重命名目录"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        okText="保存"
        cancelText="取消"
        confirmLoading={renameSubmitting}
        onOk={() => void submitRename()}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          当前：{selectedPath ?? '—'}（须为空目录）
        </Text>
        <Input
          placeholder="新目录名（单段）"
          value={renameTo}
          onChange={(e) => setRenameTo(e.target.value)}
          onPressEnter={() => void submitRename()}
        />
      </Modal>
    </Space>
  )
}
