import Dexie, { type EntityTable } from 'dexie'
import type { Canvas, DesignEdge, DesignNode, Project } from '@/domain/types'

export class GameDesignDB extends Dexie {
  projects!: EntityTable<Project, 'id'>
  canvases!: EntityTable<Canvas, 'id'>
  nodes!: EntityTable<DesignNode, 'id'>
  edges!: EntityTable<DesignEdge, 'id'>

  constructor() {
    super('GameDesignGraph')
    this.version(1).stores({
      projects: 'id, updatedAt, name',
      canvases: 'id, projectId, updatedAt',
      nodes: 'id, projectId, canvasId, type, name',
      edges: 'id, projectId, canvasId, from, to',
    })
  }
}

export const db = new GameDesignDB()
