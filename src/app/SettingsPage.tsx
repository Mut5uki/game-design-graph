import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listProjects, updateProject } from '@/db/repositories'
import { encryptApiKey, maskApiKey } from '@/lib/crypto'
import type { DeepseekModel, Project } from '@/domain/types'
import {
  formatSignalingUrls,
  loadCollabSettings,
  parseSignalingUrls,
  saveCollabSettings,
  type CollabMode,
} from '@/collab/types'
import { getSuggestedCollabWsUrl, isInviteUrlLocalhostOnly } from '@/collab/publicUrls'
import { applyLocalHostPreset, HOST_MODE_HINT } from '@/collab/hostPreset'
import { getDiskDataDir, isDiskStorageAvailable } from '@/db/diskSync'
import { Button, Input, Label, Select } from '@/components/ui/primitives'

export function SettingsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [apiKey, setApiKey] = useState('')
  const [masked, setMasked] = useState('')
  const [model, setModel] = useState<DeepseekModel>('deepseek-chat')
  const [saved, setSaved] = useState(false)
  const [collabMode, setCollabMode] = useState<CollabMode>('p2p')
  const [collabInviteBaseUrl, setCollabInviteBaseUrl] = useState('')
  const [collabServerUrl, setCollabServerUrl] = useState('')
  const [collabSignaling, setCollabSignaling] = useState('')
  const [collabRoomPassword, setCollabRoomPassword] = useState('')
  const [collabDisplayName, setCollabDisplayName] = useState('')
  const [collabSaved, setCollabSaved] = useState(false)
  const [hostDetectMsg, setHostDetectMsg] = useState<string | null>(null)
  const [hostDetecting, setHostDetecting] = useState(false)

  useEffect(() => {
    listProjects().then((ps) => {
      setProjects(ps)
      if (ps.length) setSelectedId(ps[0].id)
    })
    const collab = loadCollabSettings()
    setCollabMode(collab.mode)
    setCollabInviteBaseUrl(collab.inviteBaseUrl)
    setCollabServerUrl(collab.serverUrl)
    setCollabSignaling(formatSignalingUrls(collab.signalingUrls))
    setCollabRoomPassword(collab.roomPassword)
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
      mode: collabMode,
      inviteBaseUrl: collabInviteBaseUrl.trim().replace(/\/$/, ''),
      serverUrl: collabServerUrl.trim() || getSuggestedCollabWsUrl(),
      signalingUrls: parseSignalingUrls(collabSignaling),
      roomPassword: collabRoomPassword.trim(),
      displayName: collabDisplayName.trim(),
    })
    setCollabSaved(true)
    setTimeout(() => setCollabSaved(false), 2000)
  }

  const handleApplyHostPreset = async (mode: CollabMode) => {
    setHostDetecting(true)
    setHostDetectMsg(null)
    try {
      const current = loadCollabSettings()
      const result = await applyLocalHostPreset(mode, current)
      if (!result) {
        setHostDetectMsg('未能检测到局域网 IP。请手动填写，或确认浏览器允许网络访问。')
        return
      }
      setCollabMode(mode)
      setCollabInviteBaseUrl(result.inviteUrl)
      if (result.wsUrl) setCollabServerUrl(result.wsUrl)
      setHostDetectMsg(
        `已填入 ${result.lanIp}。请先运行 ${
          mode === 'server' ? 'start-with-collab.bat' : 'start.bat'
        }，同事访问 ${result.inviteUrl}。保存后复制邀请链接。${HOST_MODE_HINT.remote}`,
      )
    } finally {
      setHostDetecting(false)
    }
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
            可以<strong>用你自己的电脑当主机</strong>：跑 <code className="text-[11px] bg-gray-100 px-1 rounded">start-with-collab.bat</code>，
            同事连你的局域网 IP 即可（见下方「本机作为主机」）。不必买云服务器。
            P2P 模式只需你的电脑提供网页，画布数据在浏览器之间直连。
          </p>

          <div className="rounded-md border border-sky-100 bg-sky-50/60 p-3 space-y-2">
            <p className="text-xs font-medium text-sky-800">本机作为主机</p>
            <p className="text-[10px] text-sky-700/80">{HOST_MODE_HINT.server}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={hostDetecting}
                onClick={() => handleApplyHostPreset('server')}
              >
                {hostDetecting ? '检测中…' : '检测 IP · 服务器模式'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={hostDetecting}
                onClick={() => handleApplyHostPreset('p2p')}
              >
                检测 IP · P2P 模式
              </Button>
            </div>
            {hostDetectMsg && (
              <p className="text-[10px] text-sky-800 whitespace-pre-wrap">{hostDetectMsg}</p>
            )}
          </div>

          <div>
            <Label>邀请链接地址（同事打开的网页）</Label>
            <Input
              value={collabInviteBaseUrl}
              onChange={(e) => setCollabInviteBaseUrl(e.target.value)}
              placeholder="http://120.46.79.53 或 http://192.168.1.5:3888"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              复制邀请链接时使用此地址。你在本机用 localhost 开发时<strong>必须填写</strong>公网 IP 或局域网 IP，否则同事打不开。
              {isInviteUrlLocalhostOnly() && !collabInviteBaseUrl.trim() && (
                <span className="text-amber-600"> 当前未设置，链接仍是 localhost。</span>
              )}
            </p>
          </div>

          <div>
            <Label>协作方式</Label>
            <Select value={collabMode} onChange={(e) => setCollabMode(e.target.value as CollabMode)}>
              <option value="p2p">P2P（WebRTC，数据不经协作服务器）</option>
              <option value="server">服务器（WebSocket 中继）</option>
            </Select>
          </div>

          {collabMode === 'p2p' ? (
            <>
              <div>
                <Label>信令服务器（每行一个 wss:// 地址）</Label>
                <textarea
                  value={collabSignaling}
                  onChange={(e) => setCollabSignaling(e.target.value)}
                  placeholder="wss://signaling.yjs.dev"
                  className="w-full min-h-[72px] rounded-md border border-gray-200 px-2.5 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 font-mono"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  默认使用 Yjs 公共信令（仅握手，不含画布内容）。自建：运行
                  <code className="mx-0.5 bg-gray-100 px-1 rounded">npm run collab:signaling</code>
                  后填 ws://你的地址:4444
                </p>
              </div>
              <div>
                <Label>房间密码（可选）</Label>
                <Input
                  type="password"
                  value={collabRoomPassword}
                  onChange={(e) => setCollabRoomPassword(e.target.value)}
                  placeholder="留空则不加密信令"
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                建议 WebSocket：
                <code className="ml-1 text-[11px] bg-gray-100 px-1 rounded">{getSuggestedCollabWsUrl()}</code>
              </p>
              <div>
                <Label>协作服务器 WebSocket 地址</Label>
                <Input
                  value={collabServerUrl}
                  onChange={(e) => setCollabServerUrl(e.target.value)}
                  placeholder={getSuggestedCollabWsUrl()}
                />
                <p className="text-[10px] text-gray-400 mt-1">HTTPS 网站必须用 wss://</p>
              </div>
            </>
          )}

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
