import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, updateProject } from '@/db/repositories'
import { encryptApiKey, maskApiKey } from '@/lib/crypto'
import type { DeepseekModel, Project } from '@/domain/types'
import { loadCollabSettings, saveCollabSettings } from '@/collab/types'
import { deriveCollabWsFromInviteBase, isInviteUrlLocalhostOnly } from '@/collab/publicUrls'
import { applySakuraFrpPreset, SAKURAFRP_TUNNEL_HINT } from '@/collab/sakurafrpPreset'
import { getDiskDataDir, isDiskStorageAvailable } from '@/db/diskSync'
import { Button, Input, Label, Select } from '@/components/ui/primitives'

export function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [masked, setMasked] = useState('')
  const [model, setModel] = useState<DeepseekModel>('deepseek-chat')
  const [saved, setSaved] = useState(false)
  const [collabInviteBaseUrl, setCollabInviteBaseUrl] = useState('')
  const [collabDisplayName, setCollabDisplayName] = useState('')
  const [collabSaved, setCollabSaved] = useState(false)
  const [sakuraPublicUrl, setSakuraPublicUrl] = useState('')
  const [sakuraMsg, setSakuraMsg] = useState<string | null>(null)
  const [showPeerCursors, setShowPeerCursors] = useState(true)
  const [showPeerSelections, setShowPeerSelections] = useState(true)

  useEffect(() => {
    listProjects().then((ps) => {
      setProjects(ps)
      if (ps.length) setSelectedId(ps[0].id)
    })
    const collab = loadCollabSettings()
    setCollabInviteBaseUrl(collab.inviteBaseUrl)
    setSakuraPublicUrl(collab.inviteBaseUrl)
    setCollabDisplayName(collab.displayName)
    setShowPeerCursors(collab.showPeerCursors !== false)
    setShowPeerSelections(collab.showPeerSelections !== false)
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
    const raw = (sakuraPublicUrl || collabInviteBaseUrl).trim()
    if (!raw) {
      saveCollabSettings({
        inviteBaseUrl: '',
        serverUrl: '',
        displayName: collabDisplayName.trim(),
        showPeerCursors,
        showPeerSelections,
      })
      setCollabInviteBaseUrl('')
      setCollabSaved(true)
      setTimeout(() => setCollabSaved(false), 2000)
      return
    }
    const preset = applySakuraFrpPreset({ publicUrl: raw })
    const inviteBaseUrl = preset?.settings.inviteBaseUrl ?? raw.replace(/\/$/, '')
    const serverUrl = preset?.settings.serverUrl ?? deriveCollabWsFromInviteBase(inviteBaseUrl)
    saveCollabSettings({
      inviteBaseUrl,
      serverUrl,
      displayName: collabDisplayName.trim(),
      showPeerCursors,
      showPeerSelections,
    })
    setCollabInviteBaseUrl(inviteBaseUrl)
    setSakuraPublicUrl(inviteBaseUrl)
    setCollabSaved(true)
    setTimeout(() => setCollabSaved(false), 2000)
  }

  const handleApplySakuraFrp = () => {
    setSakuraMsg(null)
    const result = applySakuraFrpPreset({ publicUrl: sakuraPublicUrl })
    if (!result) {
      setSakuraMsg('请填写樱花面板日志里的公网访问地址。')
      return
    }
    setCollabInviteBaseUrl(result.settings.inviteBaseUrl)
    const warn = result.warnings.length ? `\n\n⚠ ${result.warnings.join('\n⚠ ')}` : ''
    setSakuraMsg(
      `邀请：${result.settings.inviteBaseUrl}\n协作：${result.settings.serverUrl}${warn}\n\n请保存设置，并运行 start-with-sakurafrp.bat。`,
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
          <Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← 返回</Link>
          <span className="font-semibold text-gray-900">设置</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
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

        <section id="collab" className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6 space-y-4">
          <h2 className="font-medium text-gray-900">樱花协作（SakuraFrp）</h2>
          <p className="text-xs text-gray-400">
            双击 <code className="text-[11px] bg-gray-100 px-1 rounded">start-with-sakurafrp.bat</code> 启动本机服务，
            樱花映射 <strong className="font-medium text-gray-600">3888</strong> 一条隧道即可。
            详见 <code className="text-[11px] bg-gray-100 px-1 rounded">docs/COLLAB_SAKURAFRP.md</code>。
          </p>

          <div className="rounded-md border border-pink-100 bg-pink-50/60 p-3 space-y-3">
            <p className="text-[10px] text-pink-800/90 leading-relaxed">
              {SAKURAFRP_TUNNEL_HINT.single} {SAKURAFRP_TUNNEL_HINT.node}
            </p>
            <div>
              <Label>樱花公网地址</Label>
              <Input
                value={sakuraPublicUrl}
                onChange={(e) => setSakuraPublicUrl(e.target.value)}
                placeholder="https://frp-tip.com:43337"
                className="font-mono text-xs"
              />
              <p className="text-[10px] text-pink-700/70 mt-1">
                同事只打开此地址；协作 WebSocket 自动为同域 <code className="bg-pink-100/80 px-1 rounded">/collab</code>。
                {isInviteUrlLocalhostOnly() && !sakuraPublicUrl.trim() && (
                  <span className="text-amber-600"> 当前未配置，邀请链接仍是 localhost。</span>
                )}
              </p>
            </div>
            <Button size="sm" variant="secondary" onClick={handleApplySakuraFrp}>
              预览地址
            </Button>
            {sakuraMsg && (
              <p className="text-[10px] text-pink-900 whitespace-pre-wrap leading-snug">{sakuraMsg}</p>
            )}
          </div>

          <div>
            <Label>你的显示名称</Label>
            <Input
              value={collabDisplayName}
              onChange={(e) => setCollabDisplayName(e.target.value)}
              placeholder="例如：主策划"
            />
          </div>
          <div className="space-y-2 pt-1">
            <p className="text-xs text-gray-500">画布感知（不影响数据同步，可随时关闭以减轻卡顿）</p>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showPeerCursors}
                onChange={(e) => setShowPeerCursors(e.target.checked)}
                className="rounded border-gray-300"
              />
              显示同伴指针
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showPeerSelections}
                onChange={(e) => setShowPeerSelections(e.target.checked)}
                className="rounded border-gray-300"
              />
              显示同伴选中框
            </label>
          </div>
          <Button variant="primary" onClick={handleSaveCollab}>
            {collabSaved ? '已保存' : '保存协作设置'}
          </Button>
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6 space-y-3">
          <h2 className="font-medium text-gray-900">数据存储</h2>
          {isDiskStorageAvailable() ? (
            <>
              <p className="text-sm text-gray-500">
                通过 <code className="text-[11px] bg-gray-100 px-1 rounded">start.bat</code> 或
                <code className="text-[11px] bg-gray-100 px-1 rounded">npm start</code> 启动时，项目会
                <strong className="font-medium text-gray-700">自动保存到硬盘</strong>，编辑后实时同步。
              </p>
              <p className="text-sm text-gray-500">
                备份目录：
                <code className="text-[11px] bg-gray-100 px-1 rounded break-all">
                  {getDiskDataDir() ?? 'data/projects'}
                </code>
                （每个项目一个 JSON 文件，可直接复制备份）
              </p>
              <p className="text-xs text-gray-400">
                浏览器 IndexedDB 仍作为运行缓存；启动时会从硬盘恢复较新的版本。仅静态部署（无本地服务）时无法写入硬盘。
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              当前环境无法写入硬盘（未通过本地开发服务器访问）。请使用项目根目录的
              <code className="text-[11px] bg-gray-100 px-1 rounded">start.bat</code> 启动，数据将保存到
              <code className="text-[11px] bg-gray-100 px-1 rounded">data/projects/</code>。
            </p>
          )}
        </section>

        <section className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="font-medium text-gray-900 mb-2">关于</h2>
          <p className="text-sm text-gray-500">Game Design Graph v0.1 — 游戏策划关系图编辑器</p>
        </section>
      </main>
    </div>
  )
}
