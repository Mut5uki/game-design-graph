import type { Canvas, DesignEdge, DesignNode, Project } from './index'

/** 项目完整快照，用于硬盘备份与恢复 */
export interface ProjectSnapshot {
  schemaVersion: number
  exportedAt: number
  project: Project
  canvases: Canvas[]
  nodes: DesignNode[]
  edges: DesignEdge[]
}

export interface ProjectDiskMeta {
  id: string
  name: string
  updatedAt: number
  exportedAt: number
}
