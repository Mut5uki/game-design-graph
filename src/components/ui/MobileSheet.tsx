import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MobileSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

/** 手机端底部抽屉（md 及以上不渲染） */
export function MobileSheet({ open, onClose, title, children, className }: MobileSheetProps) {
  if (!open) return null

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="关闭面板"
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-50 flex max-h-[min(85vh,100dvh)] flex-col rounded-t-xl border-t border-gray-200 bg-white shadow-2xl',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
          className,
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3">
          <span className="text-sm font-medium text-gray-900">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
