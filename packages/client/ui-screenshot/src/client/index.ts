import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { ScreenshotButton } from './ScreenshotButton.tsx'
import type { ScreenshotButtonActions } from './slots.ts'
import { en, zh, type ScreenshotKey } from './locales.ts'

export type { ScreenshotButtonActions } from './slots.ts'
export type { ScreenshotKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap { screenshot: ScreenshotKey }
}

const NS = 'screenshot'

export const inject = ['slots', 'conversation', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-screenshot: dictionaries')

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'screenshot',
    order: 10,
    locale: NS,
    inject: (_sessionId): ScreenshotButtonActions => ({
      createDraftImages: (files) => ctx.conversation.createDraftImages(files),
      releaseDraftImages: (attachments) => ctx.conversation.releaseDraftImages(attachments),
    }),
  }, ScreenshotButton))
}