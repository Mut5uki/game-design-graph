/**
 * 根据 URL 参数 ?collab=1&mode=p2p 解析协作模式
 */
import type { CollabMode } from '@/collab/types'
import { loadCollabSettings } from '@/collab/types'

export function resolveCollabModeFromUrl(): CollabMode | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('collab') !== '1') return null
  const m = params.get('mode')
  if (m === 'p2p') return 'p2p'
  if (m === 'server') return 'server'
  return loadCollabSettings().mode
}
