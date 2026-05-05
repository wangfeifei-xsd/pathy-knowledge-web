import { App, Alert, AutoComplete, Button, Card, Form, Input, Select, Space, Typography } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { api, apiErrorDetail } from '../../api/client'
import type { CompileTaskResponse, LayerFileListResponse } from '../../api/types'

const { Paragraph } = Typography

/** 未选择 raw 时的占位默认；选择素材后会按首个文件覆盖 */
const DEFAULT_COMPILE_OUTPUT_WIKI_PATH = 'compiled.md'

/** 按首个 raw 相对路径生成 wiki 输出：去掉原扩展名，固定为 .md，保留相对子目录（无前缀目录）。 */
function deriveWikiOutputFromRawPath(rawRelPath: string): string {
  const norm = rawRelPath.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  const withoutExt = norm.replace(/\.[^/.]+$/, '')
  return `${withoutExt}.md`
}

export function CompileTask() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const watchedInputPaths = Form.useWatch('input_paths', form)
  const [compileRes, setCompileRes] = useState<CompileTaskResponse | null>(null)
  const [busy, setBusy] = useState(false)

  const [rawPaths, setRawPaths] = useState<string[]>([])
  const [wikiPaths, setWikiPaths] = useState<string[]>([])
  const [pathsLoading, setPathsLoading] = useState(true)
  const [pathsTruncated, setPathsTruncated] = useState({ raw: false, wiki: false })

  const loadPaths = useCallback(async () => {
    setPathsLoading(true)
    try {
      const [r, w] = await Promise.all([
        api.get<LayerFileListResponse>('/api/v1/layers/raw/files'),
        api.get<LayerFileListResponse>('/api/v1/layers/wiki/files'),
      ])
      setRawPaths(r.data.paths)
      setWikiPaths(w.data.paths)
      setPathsTruncated({ raw: r.data.truncated, wiki: w.data.truncated })
    } catch (e) {
      message.error('加载存储路径列表失败（检查服务是否启动、Bearer 是否与 API_KEY 一致）')
      console.error(e)
    } finally {
      setPathsLoading(false)
    }
  }, [message])

  useEffect(() => {
    void loadPaths()
  }, [loadPaths])

  useEffect(() => {
    const paths = Array.isArray(watchedInputPaths) ? watchedInputPaths.filter(Boolean) : []
    const next =
      paths.length === 0 ? DEFAULT_COMPILE_OUTPUT_WIKI_PATH : deriveWikiOutputFromRawPath(paths[0])
    const cur = form.getFieldValue('output_path')
    if ((typeof cur === 'string' ? cur.trim() : '') === next) return
    form.setFieldsValue({ output_path: next })
  }, [watchedInputPaths, form])

  const onCompile = async () => {
    const v = await form.validateFields()
    setBusy(true)
    try {
      const input_paths = Array.isArray(v.input_paths) ? v.input_paths.filter(Boolean) : []
      const { data } = await api.post<CompileTaskResponse>('/api/v1/tasks/compile', {
        input_paths,
        output_path: v.output_path,
        extra_instructions: v.extra_instructions || undefined,
      })
      setCompileRes(data)
      message.success('编译完成')
    } catch (e) {
      message.error(apiErrorDetail(e) ?? '编译失败（需配置 OPENAI_API_KEY 等）')
      console.error(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card
        title="编译任务（原始 → wiki）"
        extra={
          <Button size="small" loading={pathsLoading} onClick={() => void loadPaths()}>
            刷新路径列表
          </Button>
        }
      >
        {(pathsTruncated.raw || pathsTruncated.wiki) && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="路径列表已截断"
            description="文件数量超过服务端上限，下拉框可能不完整，可在 API 中调高 max_files 或精简目录。"
          />
        )}
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="路径说明"
          description={
            <span>
              原始层：下拉来自数据目录下<strong>已存在的 raw 文件</strong>。编译输出：相对{' '}
              <strong>wiki 层根目录</strong>（一般为 <code>pathy-knowledge-server/data/wiki/</code>
              ）。选择 raw 后会按<strong>所选列表中的第一个文件</strong>自动生成路径（如{' '}
              <code>小视知识库V1-1.txt</code> → <code>小视知识库V1-1.md</code>，带子目录则保留）；仍可手动修改；列表为快捷参考，同名则覆盖。未选素材时为{' '}
              <code>{DEFAULT_COMPILE_OUTPUT_WIKI_PATH}</code>。
            </span>
          }
        />
        <Form form={form} layout="vertical" initialValues={{ output_path: DEFAULT_COMPILE_OUTPUT_WIKI_PATH }}>
          <Form.Item
            name="input_paths"
            label="原始层文件（可多选）"
            rules={[{ required: true, message: '请选择至少一个 raw 文件' }]}
          >
            <Select
              mode="multiple"
              placeholder={
                pathsLoading
                  ? '加载路径…'
                  : rawPaths.length
                    ? '从 raw 层选择已有文件'
                    : 'raw 层暂无文件或未加载成功'
              }
              loading={pathsLoading}
              options={rawPaths.map((p) => ({ label: p, value: p }))}
              showSearch
              optionFilterProp="label"
              allowClear
            />
          </Form.Item>
          <Form.Item
            name="output_path"
            label="编译输出（wiki 相对路径，随所选 raw 首项填充）"
            normalize={(v) => (typeof v === 'string' ? v.trim() : v)}
            rules={[
              { required: true, message: '请填写 wiki 输出路径' },
              {
                validator: (_, value) => {
                  const s = typeof value === 'string' ? value.trim() : ''
                  if (!s) return Promise.resolve()
                  if (s.includes('..') || s.startsWith('/') || s.startsWith('\\'))
                    return Promise.reject(new Error('请使用相对路径，勿含 .. 或绝对路径前缀'))
                  return Promise.resolve()
                },
              },
            ]}
          >
            <AutoComplete
              placeholder="选择 raw 后自动填入与文件名对应的 .md（保留子目录）"
              allowClear
              options={wikiPaths.map((p) => ({ value: p, label: p }))}
              filterOption={(input, option) =>
                (option?.value?.toString() ?? '').toLowerCase().includes(input.toLowerCase())
              }
              notFoundContent={pathsLoading ? '加载路径…' : wikiPaths.length ? null : '暂无已有 wiki 文件，可直接输入新路径'}
            />
          </Form.Item>
          <Form.Item name="extra_instructions" label="附加说明（可选）">
            <Input.TextArea rows={3} placeholder="可选：面向模型的额外指令" />
          </Form.Item>
          <Button type="primary" onClick={() => void onCompile()} loading={busy} disabled={pathsLoading}>
            执行编译
          </Button>
        </Form>
        {compileRes && (
          <div style={{ marginTop: 16 }}>
            <Paragraph>
              <strong>模型：</strong>
              {compileRes.model}
            </Paragraph>
            <Paragraph>
              <strong>写入：</strong>
              {compileRes.written_files.join(', ')}
            </Paragraph>
            {compileRes.usage && (
              <Paragraph type="secondary">
                tokens: {compileRes.usage.total_tokens ?? '—'}（prompt {compileRes.usage.prompt_tokens ?? '—'} /
                completion {compileRes.usage.completion_tokens ?? '—'}）
              </Paragraph>
            )}
            <Paragraph>{compileRes.message}</Paragraph>
          </div>
        )}
      </Card>
    </Space>
  )
}
