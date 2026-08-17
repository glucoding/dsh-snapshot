import { useRef, useState } from 'react'
import type { InputActions } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { captureNodeToPng, captureViewportToPng, blobToFile, type Rect } from './capture.ts'
import { RegionOverlay } from './RegionOverlay.tsx'
import type { ScreenshotButtonActions } from './slots.ts'
import type { ScreenshotKey } from './locales.ts'

export interface ScreenshotButtonProps {
  inputActions: Pick<InputActions, 'addImages'>
  actions: ScreenshotButtonActions
  t(key: ScreenshotKey): string
}

export function ScreenshotButton({ inputActions, actions, t }: ScreenshotButtonProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const busy = useRef(false)

  async function finish(blob: Blob): Promise<void> {
    const file = blobToFile(blob, `screenshot-${Date.now()}.png`)
    const attachments = actions.createDraftImages([file])
    if (!inputActions.addImages(attachments.map(a => a.id))) {
      actions.releaseDraftImages(attachments)
    }
  }

  async function captureViewport(): Promise<void> {
    busy.current = true
    try { await finish(await captureViewportToPng({ pixelRatio: window.devicePixelRatio })) }
    finally { busy.current = false; setOpen(false) }
  }

  async function captureRegion(rect: Rect): Promise<void> {
    setSelecting(false)
    busy.current = true
    try {
      const blob = await captureNodeToPng(document.body, { pixelRatio: window.devicePixelRatio, rect })
      await finish(blob)
    } finally { busy.current = false }
  }

  return (
    <>
      <button type="button" disabled={busy.current} aria-label={t('button.label')} onClick={() => setOpen(v => !v)}>
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
