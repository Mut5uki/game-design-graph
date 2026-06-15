import { useMemo, useState } from 'react'
import type { AiGraphOutput } from '@/ai/schemas/graphSchema'
import { getNodeMeta, getRelationLabel } from '@/domain/templates/nodeTemplates'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/primitives'

interface AiPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: AiGraphOutput
  existingNodeIds?: string[]
  existingEdgeIds?: string[]
  onApply: (patch: AiGraphOutput) => void
}

export function AiPreviewModal({
  open,
  onOpenChange,
  data,
  existingNodeIds = [],
  existingEdgeIds = [],
  onApply,
}: AiPreviewModalProps) {
  const existingNodeSet = useMemo(() => new Set(existingNodeIds), [existingNodeIds])
  const existingEdgeSet = useMemo(() => new Set(existingEdgeIds), [existingEdgeIds])

  const [selectedNodes, setSelectedNodes] = useState(() => new Set(data.nodes.map((n) => n.id)))
  const [selectedEdges, setSelectedEdges] = useState(() =>
    new Set(data.edges.map((e, i) => e.id ?? `edge-${i}`)),
  )

  const toggleNode = (id: string) => {
    setSelectedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleEdge = (key: string) => {
    setSelectedEdges((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleApply = () => {
    onApply({
      nodes: data.nodes.filter((n) => selectedNodes.has(n.id)),
      edges: data.edges.filter((e, i) => selectedEdges.has(e.id ?? `edge-${i}`)),
      explanation: data.explanation,
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="AI 变更预览"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>取消</Button>
          <Button variant="primary" onClick={handleApply}>应用到画布</Button>
        </>
      }
    >
      {data.explanation && (
        <p className="text-sm text-gray-600 mb-4">{data.explanation}</p>
      )}

      <div className="space-y-4">
        <section>
          <h3 className="text-xs font-medium text-gray-500 mb-2">节点 ({data.nodes.length})</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.nodes.map((n) => {
              const isUpdate = existingNodeSet.has(n.id)
              return (
                <label
                  key={n.id}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input type="checkbox" checked={selectedNodes.has(n.id)} onChange={() => toggleNode(n.id)} />
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getNodeMeta(n.type).color }} />
                  <span className="font-medium">{n.name}</span>
                  <span className="text-xs text-gray-400 font-mono">{n.id}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded ${
                      isUpdate ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {isUpdate ? '更新' : '新建'}
                  </span>
                </label>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-medium text-gray-500 mb-2">连线 ({data.edges.length})</h3>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {data.edges.map((e, i) => {
              const key = e.id ?? `edge-${i}`
              const isUpdate = e.id ? existingEdgeSet.has(e.id) : false
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm py-1 px-2 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input type="checkbox" checked={selectedEdges.has(key)} onChange={() => toggleEdge(key)} />
                  <span className="font-mono text-xs text-gray-600 flex-1">
                    {e.from} → {e.to} ({getRelationLabel(e.relationType)})
                    {e.label ? ` · ${e.label}` : ''}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                      isUpdate ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
                    }`}
                  >
                    {isUpdate ? '更新' : '新建'}
                  </span>
                </label>
              )
            })}
          </div>
        </section>
      </div>
    </Modal>
  )
}
