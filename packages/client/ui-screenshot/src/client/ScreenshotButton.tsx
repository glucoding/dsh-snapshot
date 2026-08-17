import { useState } from 'react'
import type { InputActions } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import { captureNodeToPng, captureViewportToPng, blobToFile, type Rect } from './capture.ts'
import { RegionOverlay } from './RegionOverlay.tsx'
import type { ScreenshotButtonActions } from './slots.ts'

export interface ScreenshotButtonProps extends ScreenshotButtonActions {
  inputActions: Pick<InputActions, 'addImages'>
}

export function ScreenshotButton({ inputActions, createDraftImages, releaseDraftImages, t }: ScreenshotButtonProps & PropsLocale<'screenshot'>): JSX.Element {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [busy, setBusy] = useState(false)

  async function finish(blob: Blob): Promise<void> {
    const file = blobToFile(blob, `screenshot-${Date.now()}.png`)
    const attachments = createDraftImages([file])
    if (!inputActions.addImages(attachments.map(a => a.id))) {
      releaseDraftImages(attachments)
    }
  }

  async function captureViewport(): Promise<void> {
    if (busy) return
    setBusy(true)
    try { await finish(await captureViewportToPng({ pixelRatio: window.devicePixelRatio })) }
    finally { setBusy(false); setOpen(false) }
  }

  async function captureRegion(rect: Rect): Promise<void> {
    if (busy) return
    setSelecting(false)
    setBusy(true)
    try {
      const blob = await captureNodeToPng(document.body, { pixelRatio: window.devicePixelRatio, rect })
      await finish(blob)
    } finally { setBusy(false) }
  }

  return (
    <>
      <button type="button" disabled={busy} aria-label={t('button.label')} onClick={() => setOpen(v => !v)}>
        {t('button.label')}
      </button>
      {open ? (
        <div role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setSelecting(true) }}>{t('mode.region')}</button>
          <button type="button" role="menuitem" onClick={() => void captureViewport()}>{t('mode.viewport')}</button>
        </div>
      ) : null}
      {selecting ? <RegionOverlay t={t} onCancel={() => setSelecting(false)} onComplete={(r) => void captureRegion(r)} /> : null}
    </>
  )
}
