import { v4 as uuidv4 } from 'uuid'
import { db } from './index'
import { deleteProjectFromDisk, queueProjectDiskSync } from './diskSync'
import type { Canvas, DesignEdge, DesignNode, Project } from '@/domain/types'

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}

export async function getProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id)
}

export async function createProject(name: string, description?: string): Promise<Project> {
  const now = Date.now()
  const project: Project = {
    id: uuidv4(),
    name,
    description,
    schemaVersion: 1,
    createdAt: now,
    updatedAt: now,
    settings: { deepseekModel: 'deepseek-chat' },
  }

  const canvas: Canvas = {
    id: uuidv4(),
    projectId: project.id,
    name: '主画布',
    viewport: { x: 0, y: 0, zoom: 1 },
    nodeIds: [],
    edgeIds: [],
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.projects, db.canvases, async () => {
    await db.projects.add(project)
    await db.canvases.add(canvas)
  })

  queueProjectDiskSync(project.id)
  return project
}

export async function updateProject(project: Project): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() })
  queueProjectDiskSync(project.id)
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.canvases, db.nodes, db.edges, async () => {
    await db.nodes.where('projectId').equals(id).delete()
    await db.edges.where('projectId').equals(id).delete()
    await db.canvases.where('projectId').equals(id).delete()
    await db.projects.delete(id)
  })
  void deleteProjectFromDisk(id).catch((err) => {
    console.warn('[diskSync] 删除硬盘备份失败:', err)
  })
}

export async function listCanvases(projectId: string): Promise<Canvas[]> {
  return db.canvases.where('projectId').equals(projectId).sortBy('createdAt')
}

export async function getCanvas(id: string): Promise<Canvas | undefined> {
  return db.canvases.get(id)
}

export async function createCanvas(projectId: string, name: string): Promise<Canvas> {
  const now = Date.now()
  const canvas: Canvas = {
    id: uuidv4(),
    projectId,
    name,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodeIds: [],
    edgeIds: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.canvases.add(canvas)
  await db.projects.update(projectId, { updatedAt: now })
  queueProjectDiskSync(projectId)
  return canvas
}

export async function updateCanvas(canvas: Canvas): Promise<void> {
  await db.canvases.put({ ...canvas, updatedAt: Date.now() })
  queueProjectDiskSync(canvas.projectId)
}

export async function deleteCanvas(canvasId: string, projectId: string): Promise<void> {
  await db.transaction('rw', db.canvases, db.nodes, db.edges, db.projects, async () => {
    await db.nodes.where('canvasId').equals(canvasId).delete()
    await db.edges.where('canvasId').equals(canvasId).delete()
    await db.canvases.delete(canvasId)
    await db.projects.update(projectId, { updatedAt: Date.now() })
  })
  queueProjectDiskSync(projectId)
}

/** 协作者通过邀请链接加入时，本地可能没有对应项目/画布，创建占位记录以便进入编辑器 */
export async function ensureCollabStubAccess(
  projectId: string,
  canvasId: string,
): Promise<{ project: Project; canvas: Canvas }> {
  const now = Date.now()
  let project = await getProject(projectId)
  if (!project) {
    project = {
      id: projectId,
      name: '协作项目',
      description: '通过协作邀请链接加入；画布内容由实时协作同步。',
      schemaVersion: 1,
      createdAt: now,
      updatedAt: now,
      settings: { deepseekModel: 'deepseek-chat' },
    }
    await db.projects.add(project)
  }

  let canvas = await getCanvas(canvasId)
  if (!canvas) {
    canvas = {
      id: canvasId,
      projectId,
      name: '协作画布',
      viewport: { x: 0, y: 0, zoom: 1 },
      nodeIds: [],
      edgeIds: [],
      createdAt: now,
      updatedAt: now,
    }
    await db.canvases.add(canvas)
  }

  return { project, canvas }
}

export async function loadCanvasData(canvasId: string): Promise<{
  nodes: DesignNode[]
  edges: DesignEdge[]
}> {
  const [nodes, edges] = await Promise.all([
    db.nodes.where('canvasId').equals(canvasId).toArray(),
    db.edges.where('canvasId').equals(canvasId).toArray(),
  ])
  return { nodes, edges }
}

export async function saveCanvasData(
  canvas: Canvas,
  nodes: DesignNode[],
  edges: DesignEdge[],
): Promise<void> {
  const now = Date.now()
  const updatedCanvas: Canvas = {
    ...canvas,
    nodeIds: nodes.map((n) => n.id),
    edgeIds: edges.map((e) => e.id),
    updatedAt: now,
  }

  await db.transaction('rw', db.canvases, db.nodes, db.edges, db.projects, async () => {
    await db.nodes.where('canvasId').equals(canvas.id).delete()
    await db.edges.where('canvasId').equals(canvas.id).delete()
    if (nodes.length) await db.nodes.bulkPut(nodes)
    if (edges.length) await db.edges.bulkPut(edges)
    await db.canvases.put(updatedCanvas)
    await db.projects.update(canvas.projectId, { updatedAt: now })
  })
  queueProjectDiskSync(canvas.projectId)
}

export async function listProjectNodeIds(projectId: string): Promise<string[]> {
  const nodes = await db.nodes.where('projectId').equals(projectId).toArray()
  return nodes.map((n) => n.id)
}

export async function getProjectSummary(projectId: string): Promise<{
  nodes: DesignNode[]
  edges: DesignEdge[]
}> {
  const [nodes, edges] = await Promise.all([
    db.nodes.where('projectId').equals(projectId).toArray(),
    db.edges.where('projectId').equals(projectId).toArray(),
  ])
  return { nodes, edges }
}
