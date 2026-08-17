import { toPng } from 'html-to-image'

/** Pure capture geometry and size-limit math; the html-to-image call lives beside it. */
export interface Rect { left: number; top: number; width: number; height: number }

/** Cap the device pixel ratio so screenshots stay within attachment budgets. */
export function clampPixelRatio(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1
  return Math.min(dpr, 2)
}

/** Normalize a drag from two corners into a Rect; undefined when below 8px on either axis. */
export function normalizeRegion(x1: number, y1: number, x2: number, y2: number): Rect | undefined {
  const left = Math.min(x1, x2)
  const top = Math.min(y1, y2)
  const width = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)
  if (width < 8 || height < 8) return undefined
  return { left, top, width, height }
}

/** Visible viewport rectangle in CSS pixels. */
export function viewportRect(): Rect {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
}

/** Shrink dimensions (preserving aspect ratio) until the 4B/px upper bound fits maxBytes. */
export function clampDimensions(width: number, height: number, maxBytes: number): { width: number; height: number } {
  let w = width
  let h = height
  while (w * h * 4 > maxBytes && w > 8 && h > 8) {
    w = Math.floor(w * 0.9)
    h = Math.floor(h * 0.9)
  }
  return { width: w, height: h }
}

export async function captureViewportToPng(opts: { pixelRatio: number }): Promise<Blob> {
  const dataUrl = await toPng(document.documentElement, {
    pixelRatio: clampPixelRatio(opts.pixelRatio), cacheBust: true,
    width: window.innerWidth, height: window.innerHeight,
  })
  return await (await fetch(dataUrl)).blob()
}

export async function captureNodeToPng(node: HTMLElement, opts: { pixelRatio: number; rect?: Rect }): Promise<Blob> {
  const style = opts.rect === undefined ? {} : {
    width: String(opts.rect.width), height: String(opts.rect.height),
    transform: `translate(${-opts.rect.left}px, ${-opts.rect.top}px)`,
  }
  const dataUrl = await toPng(node, {
    pixelRatio: clampPixelRatio(opts.pixelRatio), cacheBust: true, style,
    ...(opts.rect === undefined ? {} : { width: opts.rect.width, height: opts.rect.height }),
  })
  return await (await fetch(dataUrl)).blob()
}

export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: 'image/png' })
}

