import { useEditorStore } from '@/store/editorStore'
import { cn } from '@/lib/utils'

export function ValidationPanel() {
  const issues = useEditorStore((s) => s.validationIssues)
  const show = useEditorStore((s) => s.showValidationPanel)
  const setShow = useEditorStore((s) => s.setShowValidationPanel)
  const focusNode = useEditorStore((s) => s.focusNode)

  if (!show) return null

  const errors = issues.filter((i) => i.level === 'error')
  const warns = issues.filter((i) => i.level === 'warn')
  const infos = issues.filter((i) => i.level === 'info')

  return (
    <div className="absolute bottom-14 md:bottom-10 left-2 right-2 max-h-48 overflow-hidden flex flex-col z-10 md:left-44 md:right-80 md:mx-4 bg-white border border-gray-200 rounded-lg shadow-lg">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          校验结果
          <span className="ml-2 text-xs text-gray-400">
            {errors.length} 错误 · {warns.length} 警告 · {infos.length} 提示
          </span>
        </span>
        <button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600 text-sm">关闭</button>
      </div>
      <div className="overflow-y-auto p-2 space-y-1">
        {issues.length === 0 && (
          <p className="text-sm text-green-600 px-2 py-1">未发现问题</p>
        )}
        {issues.map((issue) => (
          <button
            key={issue.id}
            onClick={() => issue.nodeIds?.[0] && focusNode(issue.nodeIds[0])}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded text-sm hover:bg-gray-50',
              issue.level === 'error' && 'text-red-600',
              issue.level === 'warn' && 'text-amber-600',
              issue.level === 'info' && 'text-gray-500',
            )}
          >
            [{issue.level}] {issue.message}
          </button>
        ))}
      </div>
    </div>
  )
}
