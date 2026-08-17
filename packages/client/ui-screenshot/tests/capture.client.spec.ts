// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { toPng } from 'html-to-image'
import { blobToFile, captureViewportToPng, clampDimensions, clampPixelRatio, normalizeRegion, viewportRect } from '../src/client/capture.ts'

vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,AAAA') }))

describe('capture geometry', () => {
  it('clamps devicePixelRatio to 2', () => {
    expect(clampPixelRatio(1)).toBe(1)
    expect(clampPixelRatio(1.5)).toBe(1.5)
    expect(clampPixelRatio(3)).toBe(2)
    expect(clampPixelRatio(0)).toBe(1)
  })
  it('normalizes a drag rect and rejects sub-8px selections', () => {
    expect(normalizeRegion(100, 50, 20, 80)).toEqual({ left: 20, top: 50, width: 80, height: 30 })
    expect(normalizeRegion(0, 0, 5, 100)).toBeUndefined()
    expect(normalizeRegion(0, 0, 100, 3)).toBeUndefined()
  })
  it('clamps dimensions so the 4-byte-per-pixel upper bound fits maxBytes', () => {
    const r = clampDimensions(4000, 2000, 4 * 1024 * 1024)
    expect(r.width * r.height * 4).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(r.width / r.height).toBeCloseTo(4000 / 2000)
  })
  it('exposes the viewport rect', () => {
    const r = viewportRect()
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
  })
})

describe('html-to-image capture backend', () => {
  it('captures the viewport through toPng with a clamped pixel ratio', async () => {
    await captureViewportToPng({ pixelRatio: 3 })
    expect(toPng).toHaveBeenCalledWith(document.documentElement, expect.objectContaining({ pixelRatio: 2 }))
  })
  it('wraps a Blob into a File with image/png type and the given name', () => {
    const f = blobToFile(new Blob(['x']), 'shot.png')
    expect(f.type).toBe('image/png')
    expect(f.name).toBe('shot.png')
  })
})
