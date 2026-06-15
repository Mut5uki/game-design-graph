import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createProject, deleteProject, listProjects } from '@/db/repositories'
import type { Project } from '@/domain/types'
import { formatDate } from '@/lib/utils'
import { Button, Input } from '@/components/ui/primitives'
import { Modal } from '@/components/ui/Modal'

export function ProjectListPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')

  const refresh = async () => {
    setProjects(await listProjects())
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleCreate = async () => {
    if (!newName.trim()) return
    const project = await createProject(newName.trim())
    setShowCreate(false)
    setNewName('')
    navigate(`/project/${project.id}`)
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定删除项目「${name}」？此操作不可恢复。`)) return
    await deleteProject(id)
    refresh()
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-blue-600 flex items-center justify-center text-white text-sm font-bold">G</div>
            <span className="font-semibold text-gray-900">Game Design Graph</span>
          </div>
          <Link to="/settings" className="text-sm text-gray-500 hover:text-gray-700">设置</Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold text-gray-900">我的项目</h1>
          <Button variant="primary" onClick={() => setShowCreate(true)}>新建项目</Button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">加载中…</p>
        ) : projects.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 mb-4">还没有项目，创建第一个开始设计吧</p>
            <Button variant="primary" onClick={() => setShowCreate(true)}>新建项目</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center justify-between hover:border-gray-300 transition-colors"
              >
                <button
                  className="text-left flex-1"
                  onClick={() => navigate(`/project/${p.id}`)}
                >
                  <div className="font-medium text-gray-900">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-1">更新于 {formatDate(p.updatedAt)}</div>
                </button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id, p.name)}>删除</Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal
        open={showCreate}
        onOpenChange={setShowCreate}
        title="新建项目"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newName.trim()}>创建</Button>
          </>
        }
      >
        <Input
          placeholder="项目名称"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          autoFocus
        />
      </Modal>
    </div>
  )
}
