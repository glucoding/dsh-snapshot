// @vitest-environment jsdom
/**
 * ui-screenshot browser half on a real cordis Context with fake slots/locale/
 * conversation faces: the plugin registers the ScreenshotButton entry at
 * conversation.input.left, the inject face forwards the File -> draft-image
 * bridge to ctx.conversation, and registration disposal rides the plugin
 * fiber (HMR safety).
 */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the conversation face merge (ctx.conversation).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ScreenshotButtonActions } from '../src/client/slots.ts'
import { apply, inject } from '../src/client/index.ts'

/** Boot the plugin over fake faces; the conversation verbs record their calls. */
async function bench() {
  const ctx = new Context()
  const conversation = {
    createDraftImages: vi.fn(),
    releaseDraftImages: vi.fn(),
  }
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.input.left': { kind: 'list', scope: 'session' },
    },
  } as never, (() => null) as never)
  ctx.provide('conversation', conversation)
  ctx.provide('locale', new LocaleRuntime(ctx))
  const fiber = ctx.plugin({ inject: [...inject], apply })
  return {
    ctx,
    fiber,
    entry: () => {
      const entry = ctx.slots.entries('conversation.input.left')[0]
      if (entry === undefined) return undefined
      return {
        ...entry.options,
        locale: entry.locale,
        inject: entry.inject as unknown as (() => ScreenshotButtonActions) | undefined,
      }
    },
  }
}

describe('ui-screenshot browser plugin', () => {
  it('declares the services it binds', () => {
    expect(inject).toEqual(['slots', 'conversation', 'locale'])
  })

  it('registers the screenshot button, and fiber teardown removes it (HMR safety)', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.entry()).toMatchObject({ id: 'screenshot', order: 10, locale: 'screenshot' })
    expect(b.entry()?.inject).toBeTypeOf('function')
    await b.fiber.dispose()
    expect(b.entry()).toBeUndefined()
  })

  it('forwards the inject face createDraftImages/releaseDraftImages to ctx.conversation', async () => {
    const b = await bench()
    await b.fiber.await()
    const actions = b.entry()!.inject!()
    const files = [new File(['png'], 'screenshot-1.png', { type: 'image/png' })]
    const attachments = [{ kind: 'image', id: 'd1', previewUrl: 'blob:x', file: files[0] }] as never
    actions.createDraftImages(files)
    actions.releaseDraftImages(attachments)
    expect(b.ctx.conversation.createDraftImages).toHaveBeenCalledWith(files)
    expect(b.ctx.conversation.releaseDraftImages).toHaveBeenCalledWith(attachments)
  })
})
