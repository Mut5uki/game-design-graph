import { v4 as uuidv4 } from 'uuid'
import { db } from './index'
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

  return project
}

export async function updateProject(project: Project): Promise<void> {
  await db.projects.put({ ...project, updatedAt: Date.now() })
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.canvases, db.nodes, db.edges, async () => {
    await db.nodes.where('projectId').equals(id).delete()
    await db.edges.where('projectId').equals(id).delete()
    await db.canvases.where('projectId').equals(id).delete()
    await db.projects.delete(id)
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
  return canvas
}

export async function updateCanvas(canvas: Canvas): Promise<void> {
  await db.canvases.put({ ...canvas, updatedAt: Date.now() })
}

export async function deleteCanvas(canvasId: string, projectId: string): Promise<void> {
  await db.transaction('rw', db.canvases, db.nodes, db.edges, db.projects, async () => {
    await db.nodes.where('canvasId').equals(canvasId).delete()
    await db.edges.where('canvasId').equals(canvasId).delete()
    await db.canvases.delete(canvasId)
    await db.projects.update(projectId, { updatedAt: Date.now() })
  })
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
