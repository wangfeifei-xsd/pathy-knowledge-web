import { App, Select } from 'antd'
import type { SelectProps } from 'antd'
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import type { DataFolderTreeNode } from '../../api/types'
import { flattenWikiDirOptions, type WikiDirOption } from './wikiDirOptions'

type WikiPrefixMultiSelectProps = Omit<SelectProps<string[]>, 'mode' | 'options' | 'loading'>

export function WikiPrefixMultiSelect(props: WikiPrefixMultiSelectProps) {
  const { message } = App.useApp()
  const [options, setOptions] = useState<WikiDirOption[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void api
      .get<DataFolderTreeNode>('/api/v1/data-structure/tree/wiki', {
        params: { max_depth: 32, max_nodes: 2000 },
      })
      .then(({ data }) => {
        if (!cancelled) setOptions(flattenWikiDirOptions(data))
      })
      .catch(() => {
        if (!cancelled) message.error('加载 wiki 目录失败')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [message])

  return (
    <Select
      mode="multiple"
      allowClear
      showSearch
      optionFilterProp="label"
      loading={loading}
      placeholder="不选表示扫描整个 wiki；可从下拉选择多个子目录"
      options={options}
      {...props}
    />
  )
}
