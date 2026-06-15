import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

interface InlineNodeNameProps {
  nodeId: string
  value: string
  className?: string
  inputClassName?: string
  placeholder?: string
  /** 挂载后立即进入编辑 */
  autoEdit?: boolean
  onDone?: () => void
}

export function InlineNodeName({
  nodeId,
  value,
  className,
  inputClassName,
  placeholder = '名称',
  autoEdit = false,
  onDone,
}: InlineNodeNameProps) {
  const updateNode = useEditorStore((s) => s.updateNode)
  const [editing, setEditing] = useState(autoEdit)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (autoEdit) setEditing(true)
  }, [autoEdit])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const finish = () => {
    setEditing(false)
    onDone?.()
  }

  const cancel = () => {
    setDraft(value)
    finish()
  }

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) {
      updateNode(nodeId, { name: trimmed })
    } else {
      setDraft(value)
    }
    finish()
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
        className={cn(
          'nodrag nopan nowheel min-w-0 w-full bg-white border border-blue-300 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400',
          inputClassName,
        )}
      />
    )
  }

  return (
    <span
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      className={cn('cursor-text', className)}
      title="双击修改名称"
    >
      {value}
    </span>
  )
}
