import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface ContextMenuItem {
  id: string
  label: string
  shortcut?: string
  danger?: boolean
  disabled?: boolean
  separator?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
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
      {items.map((item) =>
        item.separator ? (
          <div key={item.id} className="my-1 border-t border-gray-100" />
        ) : (
          <button
            key={item.id}
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
              item.onClick()
              onClose()
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-gray-400 font-mono">{item.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>
  )
}
