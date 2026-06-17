import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  id: string
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  children?: ContextMenuItem[]
  onClick?: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

function ContextMenuRow({
  item,
  onClose,
}: {
  item: ContextMenuItem
  onClose: () => void
}) {
  const [open, setOpen] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const subRef = useRef<HTMLDivElement>(null)
  const [subStyle, setSubStyle] = useState<{ left?: number; right?: number; top: number }>({
    top: 0,
  })

  useLayoutEffect(() => {
    if (!open || !rowRef.current || !subRef.current) return
    const rowRect = rowRef.current.getBoundingClientRect()
    const subRect = subRef.current.getBoundingClientRect()
    const margin = 8
    let top = 0
    if (rowRect.top + subRect.height > window.innerHeight - margin) {
      top = Math.min(0, window.innerHeight - margin - subRect.height - rowRect.top)
    }
    const openLeft = rowRect.right + subRect.width > window.innerWidth - margin
    setSubStyle(openLeft ? { right: rowRect.width, top } : { left: rowRect.width, top })
  }, [open, item.children?.length])

  if (item.separator) {
    return <div key={item.id} className="my-1 border-t border-gray-100" />
  }

  if (item.children?.length) {
    return (
      <div
        ref={rowRef}
        className="relative"
        onMouseEnter={() => !item.disabled && setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <button
          type="button"
          disabled={item.disabled}
          className={cn(
            'w-full flex items-center justify-between gap-4 px-3 py-1.5 text-sm text-left',
            item.disabled && 'opacity-40 cursor-not-allowed',
            !item.disabled && 'hover:bg-gray-50 text-gray-700',
          )}
        >
          <span>{item.label}</span>
          <span className="text-gray-400 text-xs">›</span>
        </button>
        {open && (
          <div
            className="absolute z-10 pl-1"
            style={subStyle}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <div
              ref={subRef}
              className="min-w-[160px] max-h-[min(360px,70vh)] overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
            >
              {item.children.map((child) => (
                <ContextMenuRow key={child.id} item={child} onClose={onClose} />
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      type="button"
      disabled={item.disabled}
      className={cn(
        'w-full flex items-center justify-between gap-4 px-3 py-1.5 text-sm text-left',
        item.disabled && 'opacity-40 cursor-not-allowed',
        !item.disabled && !item.danger && 'hover:bg-gray-50 text-gray-700',
        !item.disabled && item.danger && 'hover:bg-red-50 text-red-600',
      )}
      onClick={() => {
        if (item.disabled) return
        item.onClick?.()
        onClose()
      }}
    >
      <span>{item.label}</span>
      {item.shortcut && (
        <span className="text-[10px] text-gray-400 font-mono">{item.shortcut}</span>
      )}
    </button>
  )
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    let left = x
    let top = y
    if (left + rect.width > window.innerWidth) left = window.innerWidth - rect.width - 8
    if (top + rect.height > window.innerHeight) top = window.innerHeight - rect.height - 8
    el.style.left = `${Math.max(8, left)}px`
    el.style.top = `${Math.max(8, top)}px`
  }, [x, y])

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <ContextMenuRow key={item.id} item={item} onClose={onClose} />
      ))}
    </div>
  )
}
