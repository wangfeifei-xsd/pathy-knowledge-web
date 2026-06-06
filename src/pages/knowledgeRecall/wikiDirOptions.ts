import type { DataFolderTreeNode } from '../../api/types'

export interface WikiDirOption {
  value: string
  label: string
}

/** 将 wiki 目录树展平为下拉选项（不含层根）。value 为相对层根、无首尾斜杠的路径。 */
export function flattenWikiDirOptions(root: DataFolderTreeNode): WikiDirOption[] {
  const out: WikiDirOption[] = []
  const visit = (node: DataFolderTreeNode) => {
    if (node.path) {
      const value = node.path.replace(/\/$/, '')
      out.push({ value, label: `${value}/` })
    }
    for (const child of node.children) {
      visit(child)
    }
  }
  visit(root)
  return out.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}
