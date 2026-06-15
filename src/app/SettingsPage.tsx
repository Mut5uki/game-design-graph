import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, updateProject } from '@/db/repositories'
import { encryptApiKey, maskApiKey } from '@/lib/crypto'
import type { DeepseekModel, Project } from '@/domain/types'
import {
  DEFAULT_COLLAB_SERVER_URL,
  loadCollabSettings,
  saveCollabSettings,
} from '@/collab/types'
import { Button, Input, Label, Select } from '@/components/ui/primitives'

export function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [masked, setMasked] = useState('')
  const [model, setModel] = useState<DeepseekModel>('deepseek-chat')
  const [saved, setSaved] = useState(false)
  const [collabServerUrl, setCollabServerUrl] = useState(DEFAULT_COLLAB_SERVER_URL)
  const [collabDisplayName, setCollabDisplayName] = useState('')
  const [collabSaved, setCollabSaved] = useState(false)

  useEffect(() => {
    listProjects().then((ps) => {
      setProjects(ps)
      if (ps.length) setSelectedId(ps[0].id)
    })
    const collab = loadCollabSettings()
    setCollabServerUrl(collab.serverUrl)
    setCollabDisplayName(collab.displayName)
  }, [])

  useEffect(() => {
    const p = projects.find((x) => x.id === selectedId)
    if (!p) return
    setModel(p.settings.deepseekModel)
    maskApiKey(p.settings.deepseekApiKeyEncrypted).then(setMasked)
    setApiKey('')
  }, [selectedId, projects])

  const handleSave = async () => {
    const p = projects.find((x) => x.id === selectedId)
    if (!p) return
    const settings = { ...p.settings, deepseekModel: model }
    if (apiKey.trim()) {
      settings.deepseekApiKeyEncrypted = await encryptApiKey(apiKey.trim())
    }
    const updated = { ...p, settings }
    await updateProject(updated)
    setProjects((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
    setMasked(await maskApiKey(settings.deepseekApiKeyEncrypted))
    setApiKey('')
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleSaveCollab = () => {
    saveCollabSettings({
      serverUrl: collabServerUrl.trim() || DEFAULT_COLLAB_SERVER_URL,
      displayName: collabDisplayName.trim(),
    })
    setCollabSaved(true)
    setTimeout(() => setCollabSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← 返回</Link>
          <span className="font-semibold text-gray-900">设置</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-medium text-gray-900">DeepSeek API</h2>
          <p className="text-xs text-gray-400">
            API Key 仅加密保存在本地浏览器。使用 AI 功能时，项目数据将发送至 DeepSeek 处理。
          </p>

          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">请先创建项目后再配置 API Key（Key 按项目存储）。</p>
          ) : (
            <>
              <div>
                <Label>关联项目</Label>
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>模型</Label>
                <Select value={model} onChange={(e) => setModel(e.target.value as DeepseekModel)}>
                  <option value="deepseek-chat">deepseek-chat（默认）</option>
                  <option value="deepseek-reasoner">deepseek-reasoner（复杂推理）</option>
                </Select>
              </div>
              <div>
                <Label>API Key</Label>
                {masked && <p className="text-xs text-gray-400 mb-1">当前：{masked}</p>}
                <Input
                  type="password"
                  placeholder="输入新的 API Key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <Button variant="primary" onClick={handleSave}>
                {saved ? '已保存' : '保存'}
              </Button>
            </>
          )}
        </section>

        <section id="collab" className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="font-medium text-gray-900">多人协作</h2>
          <p className="text-xs text-gray-400">
            协作数据经 WebSocket 同步；DeepSeek API Key 仍仅存本地。需先在本机或服务器运行协作服务（见项目 server/ 目录）。
          </p>
          <div>
            <Label>协作服务器 WebSocket 地址</Label>
            <Input
              value={collabServerUrl}
              onChange={(e) => setCollabServerUrl(e.target.value)}
              placeholder={DEFAULT_COLLAB_SERVER_URL}
            />
          </div>
          <div>
            <Label>你的显示名称</Label>
            <Input
              value={collabDisplayName}
              onChange={(e) => setCollabDisplayName(e.target.value)}
              placeholder="例如：主策划"
            />
          </div>
          <Button variant="primary" onClick={handleSaveCollab}>
            {collabSaved ? '已保存' : '保存协作设置'}
          </Button>
          <p className="text-xs text-gray-500">
            启动服务：在项目根目录运行 <code className="text-[11px] bg-gray-100 px-1 rounded">npm run collab:server</code>
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <h2 className="font-medium text-gray-900">数据说明</h2>
          <p className="text-sm text-gray-500">
            所有项目数据存储在浏览器 IndexedDB 中。清除浏览器数据会导致项目丢失，请注意备份。
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium text-gray-900 mb-2">关于</h2>
          <p className="text-sm text-gray-500">Game Design Graph v0.1 — 游戏策划关系图编辑器</p>
        </section>
      </main>
    </div>
  )
}
