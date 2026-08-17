import type { ComposerAttachment } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Injected face of the screenshot button: the File → draft-image bridge, forwarded from ctx.conversation. */
export interface ScreenshotButtonActions {
  createDraftImages(files: readonly File[]): readonly ComposerAttachment[]
  releaseDraftImages(attachments: readonly ComposerAttachment[]): void
}
