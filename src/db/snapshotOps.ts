import { db } from './index'
import type { ProjectSnapshot } from '@/domain/types/projectSnapshot'
import type { Project } from '@/domain/types'

export async function exportProjectSnapshot(projectId: string): Promise<ProjectSnapshot | null> {
  const project = await db.projects.get(projectId)
  if (!project) return null

  const [canvases, nodes, edges] = await Promise.all([
    db.canvases.where('projectId').equals(projectId).sortBy('createdAt'),
    db.nodes.where('projectId').equals(projectId).toArray(),
    db.edges.where('projectId').equals(projectId).toArray(),
  ])

  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    project,
    canvases,
    nodes,
    edges,
  }
}

export async function importProjectSnapshot(snapshot: ProjectSnapshot): Promise<void> {
  const { project, canvases, nodes, edges } = snapshot

  await db.transaction('rw', db.projects, db.canvases, db.nodes, db.edges, async () => {
    await db.nodes.where('projectId').equals(project.id).delete()
    await db.edges.where('projectId').equals(project.id).delete()
    await db.canvases.where('projectId').equals(project.id).delete()
    await db.projects.put(project)
    if (canvases.length) await db.canvases.bulkPut(canvases)
    if (nodes.length) await db.nodes.bulkPut(nodes)
    if (edges.length) await db.edges.bulkPut(edges)
  })
}

export async function listLocalProjects(): Promise<Project[]> {
  return db.projects.orderBy('updatedAt').reverse().toArray()
}
