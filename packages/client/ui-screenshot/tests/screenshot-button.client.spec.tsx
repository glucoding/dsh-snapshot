// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ScreenshotButton } from '../src/client/ScreenshotButton.tsx'
import { zh, type ScreenshotKey } from '../src/client/locales.ts'
import type { ScreenshotButtonActions } from '../src/client/slots.ts'

vi.mock('../src/client/capture.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../src/client/capture.ts')>()
  return { ...mod, captureViewportToPng: vi.fn(async () => new Blob(['png'])) }
})

const t = (k: ScreenshotKey) => zh[k]
afterEach(cleanup)

function makeInputActions(addImages = vi.fn(() => true)) {
  return { addImages }
}

describe('ScreenshotButton', () => {
  it('full-screen capture attaches a draft image via addImages', async () => {
    const addImages = vi.fn(() => true)
    const release = vi.fn()
    const actions: ScreenshotButtonActions = {
      createDraftImages: vi.fn((files: readonly File[]) => files.map(() => ({ id: 'd1', previewUrl: 'blob:x', file: files[0] })) as never),
      releaseDraftImages: release,
    }
    render(<ScreenshotButton inputActions={makeInputActions(addImages) as never} actions={actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: zh['button.label'] }))
    fireEvent.click(screen.getByRole('menuitem', { name: zh['mode.viewport'] }))
    await waitFor(() => expect(addImages).toHaveBeenCalled())
    expect(release).not.toHaveBeenCalled()
  })

  it('rolls back when addImages refuses (busy phase)', async () => {
    const addImages = vi.fn(() => false)
    const release = vi.fn()
    const actions: ScreenshotButtonActions = {
      createDraftImages: vi.fn(() => [{ id: 'd1', previewUrl: 'blob:x', file: new File(['x'], 's.png', { type: 'image/png' }) }]) as never,
      releaseDraftImages: release,
    }
    render(<ScreenshotButton inputActions={makeInputActions(addImages) as never} actions={actions} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: zh['button.label'] }))
    fireEvent.click(screen.getByRole('menuitem', { name: zh['mode.viewport'] }))
    await waitFor(() => expect(release).toHaveBeenCalledTimes(1))
  })
})
