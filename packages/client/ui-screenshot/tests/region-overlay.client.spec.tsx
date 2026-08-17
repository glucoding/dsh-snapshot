// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RegionOverlay } from '../src/client/RegionOverlay.tsx'
import { zh } from '../src/client/locales.ts'
import type { ScreenshotKey } from '../src/client/locales.ts'

const t = (k: ScreenshotKey) => zh[k]
afterEach(cleanup)

describe('RegionOverlay', () => {
  it('completes with a normalized rect on mouseup after a drag', () => {
    const onComplete = vi.fn()
    render(<RegionOverlay onComplete={onComplete} onCancel={vi.fn()} t={t} />)
    const layer = screen.getByRole('dialog')
    fireEvent.mouseDown(layer, { clientX: 10, clientY: 10 })
    fireEvent.mouseMove(layer, { clientX: 100, clientY: 60 })
    fireEvent.mouseUp(layer, { clientX: 100, clientY: 60 })
    expect(onComplete).toHaveBeenCalledWith({ left: 10, top: 10, width: 90, height: 50 })
  })
  it('cancels on Escape without completing', () => {
    const onComplete = vi.fn(); const onCancel = vi.fn()
    render(<RegionOverlay onComplete={onComplete} onCancel={onCancel} t={t} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onComplete).not.toHaveBeenCalled()
    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})
