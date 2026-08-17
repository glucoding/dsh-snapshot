import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { normalizeRegion, type Rect } from './capture.ts'
import type { ScreenshotKey } from './locales.ts'

export interface RegionOverlayProps {
  onComplete(rect: Rect): void
  onCancel(): void
  t(key: ScreenshotKey): string
}

export function RegionOverlay({ onComplete, onCancel, t }: RegionOverlayProps): JSX.Element {
  const [start, setStart] = useState<{ x: number; y: number } | null>(null)
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const rect = start !== null && end !== null ? normalizeRegion(start.x, start.y, end.x, end.y) : undefined
  const boxStyle: CSSProperties | undefined = rect === undefined ? undefined : {
    position: 'fixed', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
  }

  return (
    <div
      role="dialog"
      aria-label={t('overlay.aria')}
      style={{ position: 'fixed', inset: 0, cursor: 'crosshair', zIndex: 1000 }}
      onMouseDown={(e) => { setStart({ x: e.clientX, y: e.clientY }); setEnd({ x: e.clientX, y: e.clientY }) }}
      onMouseMove={(e) => { if (start !== null) setEnd({ x: e.clientX, y: e.clientY }) }}
      onMouseUp={(e) => {
        if (start !== null && end !== null) {
          const r = normalizeRegion(start.x, start.y, e.clientX, e.clientY)
          if (r !== undefined) onComplete(r)
        }
        setStart(null); setEnd(null)
      }}
    >
      {boxStyle !== undefined ? <div style={{ ...boxStyle, border: '2px solid var(--dsw-alias-accent, #4c8dff)', background: 'rgba(76,141,255,0.12)' }} /> : null}
    </div>
  )
}
