import { useEditorStore } from '@/store/editorStore'
import { getNodeMeta } from '@/domain/templates/nodeTemplates'
import { Input } from '@/components/ui/primitives'

export function TableView() {
  const nodes = useEditorStore((s) => s.nodes)
  const edges = useEditorStore((s) => s.edges)
  const updateNode = useEditorStore((s) => s.updateNode)
  const focusNode = useEditorStore((s) => s.focusNode)

  const inDegree = (id: string) => edges.filter((e) => e.to === id).length
  const outDegree = (id: string) => edges.filter((e) => e.from === id).length

  const relationSummary = (id: string) => {
    const out = edges.filter((e) => e.from === id).slice(0, 2)
    if (!out.length) return '—'
    return out.map((e) => `${e.relationType}→${e.to}`).join(', ')
  }

  return (
    <div className="h-full overflow-auto bg-white">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs text-gray-500">
            <th className="px-4 py-2 font-medium">ID</th>
            <th className="px-4 py-2 font-medium">类型</th>
            <th className="px-4 py-2 font-medium">名称</th>
            <th className="px-4 py-2 font-medium">描述</th>
            <th className="px-4 py-2 font-medium">入度</th>
            <th className="px-4 py-2 font-medium">出度</th>
            <th className="px-4 py-2 font-medium">关系摘要</th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr
              key={n.id}
              className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              onClick={() => focusNode(n.id)}
            >
              <td className="px-4 py-2 font-mono text-xs text-gray-500">{n.id}</td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getNodeMeta(n.type).color }}
                  />
                  {getNodeMeta(n.type).label}
                </span>
              </td>
              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                <Input
                  value={n.name}
                  onChange={(e) => updateNode(n.id, { name: e.target.value })}
                  className="h-7 text-sm"
                />
              </td>
              <td className="px-4 py-2 text-gray-500 max-w-xs truncate">
                {String(n.fields.description ?? '')}
              </td>
              <td className="px-4 py-2 text-center">{inDegree(n.id)}</td>
              <td className="px-4 py-2 text-center">{outDegree(n.id)}</td>
              <td className="px-4 py-2 text-xs text-gray-400 font-mono">{relationSummary(n.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {nodes.length === 0 && (
        <p className="text-center text-gray-400 py-12 text-sm">暂无节点</p>
      )}
    </div>
  )
}
