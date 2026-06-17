import { toCanvas } from 'html-to-image'
import type { ReactFlowInstance } from '@xyflow/react'

const EXPORT_PADDING = 0.1
const EXPORT_MAX_LONG_EDGE = 1920
const EXPORT_BG = '#F7F8FA'

export function sanitizeExportFileName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\s+/g, ' ').trim()
  if (cleaned.length > 120) return cleaned.slice(0, 120).trim()
  return cleaned || 'canvas'
}

function waitFrames(count = 2): Promise<void> {
  return new Promise((resolve) => {
    let left = count
    const tick = () => {
      left -= 1
      if (left <= 0) resolve()
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
}

async function downloadCanvas(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('生成 PNG 文件失败')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  link.href = url
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function scaleCanvasToMaxLongEdge(source: HTMLCanvasElement, maxLongEdge: number): HTMLCanvasElement {
  const longEdge = Math.max(source.width, source.height)
  if (longEdge <= maxLongEdge) return source

  const scale = maxLongEdge / longEdge
  const target = document.createElement('canvas')
  target.width = Math.max(1, Math.round(source.width * scale))
  target.height = Math.max(1, Math.round(source.height * scale))
  const ctx = target.getContext('2d')
  if (!ctx) return source

  ctx.fillStyle = EXPORT_BG
  ctx.fillRect(0, 0, target.width, target.height)
  ctx.drawImage(source, 0, 0, target.width, target.height)
  return target
}

function isCanvasMostlyBlank(canvas: HTMLCanvasElement): boolean {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const { width, height } = canvas
  if (width === 0 || height === 0) return true

  const stepX = Math.max(1, Math.floor(width / 24))
  const stepY = Math.max(1, Math.floor(height / 24))
  let nonBg = 0
  let samples = 0

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      samples += 1
      const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data
      if (a > 8 && (Math.abs(r - 247) > 12 || Math.abs(g - 248) > 12 || Math.abs(b - 250) > 12)) {
        nonBg += 1
      }
    }
  }

  return samples > 0 && nonBg / samples < 0.01
}

/** 导出整张画布（全部节点 + 连线），先 fitView 再截可见区域 */
export async function exportCanvasToPng(
  reactFlow: ReactFlowInstance,
  fileName: string,
): Promise<void> {
  const flowNodes = reactFlow.getNodes()
  if (flowNodes.length === 0) {
    throw new Error('画布上没有节点，无法导出 PNG')
  }

  const flowEl = document.querySelector('.react-flow')
  if (!(flowEl instanceof HTMLElement)) {
    throw new Error('找不到画布容器')
  }

  const prevViewport = reactFlow.getViewport()
  flowEl.classList.add('gdg-exporting')

  try {
    await reactFlow.fitView({
      padding: EXPORT_PADDING,
      duration: 0,
      maxZoom: 1.5,
    })
    await document.fonts?.ready
    await waitFrames(6)

    const width = flowEl.clientWidth
    const height = flowEl.clientHeight
    if (width < 8 || height < 8) {
      throw new Error('画布尺寸异常，无法导出')
    }

    let canvas = await toCanvas(flowEl, {
      backgroundColor: EXPORT_BG,
      width,
      height,
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio: 2,
      cacheBust: true,
    })

    if (isCanvasMostlyBlank(canvas)) {
      await reactFlow.fitView({ padding: 0.08, duration: 0, maxZoom: 2 })
      await waitFrames(10)
      canvas = await toCanvas(flowEl, {
        backgroundColor: EXPORT_BG,
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
        pixelRatio: 2,
        cacheBust: true,
      })
    }

    if (isCanvasMostlyBlank(canvas)) {
      throw new Error('导出结果为空，请刷新页面后重试')
    }

    await downloadCanvas(scaleCanvasToMaxLongEdge(canvas, EXPORT_MAX_LONG_EDGE), fileName)
  } finally {
    await reactFlow.setViewport(prevViewport, { duration: 0 })
    flowEl.classList.remove('gdg-exporting')
    await waitFrames(1)
  }
}

type ExportHandler = () => Promise<void>

let canvasPngExportHandler: ExportHandler | null = null

export function registerCanvasPngExport(handler: ExportHandler | null): void {
  canvasPngExportHandler = handler
}

export async function triggerCanvasPngExport(): Promise<void> {
  if (!canvasPngExportHandler) {
    throw new Error('画布尚未就绪，请稍后再试')
  }
  await canvasPngExportHandler()
}
