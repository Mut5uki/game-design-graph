import { useMemo, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { Input } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

export function SearchBar({ className }: { className?: string }) {
  const [local, setLocal] = useState('')
  const nodes = useEditorStore((s) => s.nodes)
  const focusNode = useEditorStore((s) => s.focusNode)
  const setEditorView = useEditorStore((s) => s.setEditorView)

  const results = useMemo(() => {
    const q = local.trim().toLowerCase()
    if (!q) return []
    return nodes.filter((n) => {
      const desc = String(n.fields.description ?? '').toLowerCase()
      const tags = Array.isArray(n.fields.tags) ? n.fields.tags.join(' ') : ''
      return (
        n.id.toLowerCase().includes(q) ||
        n.name.toLowerCase().includes(q) ||
        desc.includes(q) ||
        tags.toLowerCase().includes(q)
      )
    }).slice(0, 8)
  }, [local, nodes])

  return (
    <div className="relative w-full max-md:max-w-none">
      <Input
        placeholder="搜索节点…"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={cn('w-48 h-8 text-xs max-md:w-full', className)}
      />
      {results.length > 0 && local.trim() && (
        <div className="absolute top-full mt-1 right-0 max-md:left-0 w-64 max-md:w-full bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1">
          {results.map((n) => (
            <button
              key={n.id}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
              onClick={() => {
                setEditorView('canvas')
                focusNode(n.id)
                setLocal('')
              }}
            >
              <span className="font-medium text-gray-800">{n.name}</span>
              <span className="text-xs text-gray-400 ml-2">{n.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
