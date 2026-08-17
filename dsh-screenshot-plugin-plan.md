# DSH 官方截屏插件 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付官方客户端插件 `@deepseek-ai/dsh-client-ui-screenshot`，让用户在 harness Web GUI 框选/全屏截图并把 PNG 附加到消息草稿发给模型。

**Architecture:** 一个纯 client 插件（`packages/client/ui-screenshot`），通过 `dsh.client` 声明进入 `__DSH_BOOT__`，用 `ctx.slots.register` 把截图按钮挂到 `conversation.input.left`；截图用 html-to-image 栅格化 DOM，产出 PNG `File`，走既有 `ConversationController.createDraftImages → InputActions.addImages → serializeImages` 管线。对既有代码唯一侵入是暴露 `IConversation.createDraftImages/releaseDraftImages`。

**Tech Stack:** TypeScript + React 18（client 插件）、Cordis（`@deepseek-ai/cordis`）、html-to-image、tsdown（`clientBundle`）、vitest + @testing-library/react（jsdom）。

**Spec:** `E:\dsh-snapshot\dsh-screenshot-plugin-requirements.md`（v0.2，已评审）

## Global Constraints

- 包名 `@deepseek-ai/dsh-client-ui-screenshot`，目录 `packages/client/ui-screenshot`，版本 `0.1.0-rc.5`（与 monorepo 对齐）。
- `package.json` 必须含 `dsh.client = { "platform": "web", "inject": ["@deepseek-ai/dsh-client-runtime","@deepseek-ai/dsh-client-locale","@deepseek-ai/dsh-client-ui-conversation"] }`、`exports["./client"]`、`publishConfig.access=public`、`license: MIT`。
- 截图按钮挂载槽位 `conversation.input.left`（list/session），`id='screenshot'`，`order=10`。
- 采集后端 html-to-image（`toPng`），DPR 上限 2，媒体类型固定 `image/png`。
- 遵守 `imageLimits`（`maxImageBytes/maxMessageImageBytes/maxImagesPerMessage/mediaTypes`）；`addImages=false` 时回滚 `releaseDraftImages`。
- 新增 `html-to-image` 依赖（MIT，零运行时依赖）。
- 内部遵循 client 域分层 + bundle-purity；文案 EN/zh；官方门禁全绿（见 Spec §7）。
- **实现位置**：checkout `E:\dskharness\deepseek-harness`（已授权；首次写触发提权审批）。模板参照 `packages/client/ui-goal`。

---

## File Structure

**Create**（全部在 `packages/client/ui-screenshot/`）：
- `package.json` — 包清单 + `dsh.client` + `exports["./client"]`
- `tsconfig.json` — 继承 `../../../tsconfig.base.client.json` + 依赖 references
- `tsdown.config.ts` — `clientBundle('@deepseek-ai/dsh-client-ui-screenshot', [...])`
- `src/index.ts` — host 半：`export function apply(): void {}`
- `src/invariant.ts` — invariant 伴生插件（jscpd:ignore 包裹）
- `src/css-modules.d.ts` — CSS 模块声明
- `src/client/index.ts` — browser `apply/inject` + 槽位注册 + locale 注册
- `src/client/slots.ts` — `ScreenshotButtonActions` 注入面契约
- `src/client/locales.ts` — zh/en 字典 + `ScreenshotKey`
- `src/client/capture.ts` — 几何/限制纯函数 + html-to-image 封装
- `src/client/RegionOverlay.tsx` — 框选遮罩组件
- `src/client/ScreenshotButton.tsx` — 截图按钮组件
- `tests/capture.client.spec.ts`、`tests/region-overlay.client.spec.tsx`、`tests/screenshot-button.client.spec.tsx`、`tests/browser-plugin.client.spec.tsx`
- `README.md`（model-experience + Limitations）

**Modify**：
- `packages/client/ui-conversation/src/client/service.ts` — `IConversation` 增加 `createDraftImages/releaseDraftImages`
- `tsconfig.client.json` + `tsconfig.host.json` — references 增加 `./packages/client/ui-screenshot`
- `.agents/notes/proposed/2026-08-17-official-screenshot-client-plugin.md`（+ `.zh.md`）— feature Agent Note
- `pnpm-lock.yaml`（新增 html-to-image）
- 受影响的 catalog/快照生成物（`slot-catalog.ts`、web/e2e inventory 快照）

---

### Task 1: 脚手架包骨架

**Files:** Create 上表 `package.json`、`tsconfig.json`、`tsdown.config.ts`、`src/index.ts`、`src/invariant.ts`、`src/css-modules.d.ts`；Modify `tsconfig.client.json`、`tsconfig.host.json`。

**Interfaces:** 无（后续任务消费本包 `name`/`exports`）。

- [ ] **Step 1: 写 `package.json`**（复制 `ui-goal/package.json` 骨架，替换字段）

```json
{
  "name": "@deepseek-ai/dsh-client-ui-screenshot",
  "description": "Official screenshot surface: region/full-viewport capture of the harness UI, attached to the composer as a model-visible image",
  "version": "0.1.0-rc.5",
  "publishConfig": { "access": "public" },
  "repository": { "type": "git", "url": "git+https://github.com/deepseek-ai/deepseek-harness.git", "directory": "packages/client/ui-screenshot" },
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
    "./invariant": { "types": "./lib/types/invariant.d.ts", "default": "./lib/invariant.js" },
    "./client": { "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" },
    "./src/*": "./src/*",
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": {
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-locale",
        "@deepseek-ai/dsh-client-ui-conversation"
      ],
      "platform": "web"
    }
  },
  "scripts": { "bundle": "tsdown", "watch": "tsdown --watch" },
  "license": "MIT",
  "dependencies": { "html-to-image": "^1.11.11" },
  "peerDependencies": {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-attachment": "workspace:^",
    "@deepseek-ai/dsh-client-locale": "workspace:^",
    "@deepseek-ai/dsh-client-runtime": "workspace:^",
    "@deepseek-ai/dsh-client-ui-conversation": "workspace:^",
    "@deepseek-ai/dsh-client-ui-slots": "workspace:^",
    "@deepseek-ai/dsh-invariants": "workspace:^",
    "react": "^18.2.0"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "workspace:^",
    "@deepseek-ai/dsh-attachment": "workspace:^",
    "@deepseek-ai/dsh-client-locale": "workspace:^",
    "@deepseek-ai/dsh-client-runtime": "workspace:^",
    "@deepseek-ai/dsh-client-test-runtime": "workspace:^",
    "@deepseek-ai/dsh-client-ui-conversation": "workspace:^",
    "@deepseek-ai/dsh-client-ui-slots": "workspace:^",
    "@deepseek-ai/dsh-invariants": "workspace:^",
    "@testing-library/react": "^16.1.0",
    "@types/react": "~18.3.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "files": ["lib/index.js", "lib/invariant.js", "lib/client.js", "lib/types/**/*.d.ts"]
}
```

- [ ] **Step 2: 写 `tsconfig.json`**（继承 base.client，references 对齐 `ui-goal`，去掉 goal/commands，加 attachment）

```json
{
  "extends": "../../../tsconfig.base.client.json",
  "compilerOptions": { "rootDir": "src", "outDir": "lib/types" },
  "include": ["src"],
  "references": [
    { "path": "../../../vendor/cordis" },
    { "path": "../locale" },
    { "path": "../runtime" },
    { "path": "../ui-conversation" },
    { "path": "../ui-slots" },
    { "path": "../../fs/attachment" },
    { "path": "../../runtime-diagnostics/invariants" }
  ]
}
```

- [ ] **Step 3: 写 `tsdown.config.ts`**

```ts
import { clientBundle } from '../tsdown.client.ts'
export default clientBundle('@deepseek-ai/dsh-client-ui-screenshot', ['lib/types/index.js', 'lib/types/invariant.js'])
```

- [ ] **Step 4: 写 `src/index.ts`、`src/invariant.ts`、`src/css-modules.d.ts`**（复制 `ui-goal` 同名文件，仅改 `PACKAGE_NAME` 与 `name`）

`src/index.ts`:
```ts
/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(): void {}
```

`src/invariant.ts`（改 `PACKAGE_NAME`、`name='client-ui-screenshot-invariant'`，保留 `jscpd:ignore` 包裹与 `inject=['invariants']` 结构，`install: InvariantInstaller = () => {}`）。

`src/css-modules.d.ts`：复制 `ui-goal/src/css-modules.d.ts` 原文。

- [ ] **Step 5: 挂进 tsconfig 聚合**

在根 `tsconfig.client.json` 的 `references` 数组（`ui-goal` 之后）加 `{ "path": "./packages/client/ui-screenshot" }`；在根 `tsconfig.host.json` 的 `references` 数组加同一路径（host 半经 `src/index.ts` 参与）。

- [ ] **Step 6: 安装依赖并验证构建**

Run: `pnpm install`（解析 html-to-image、写 lockfile）
Run: `pnpm build:lib:client`（或 `pnpm --filter @deepseek-ai/dsh-client-ui-screenshot exec tsdown`）
Expected: 无类型/打包错误；`lib/index.js`、`lib/invariant.js` 产出（`lib/client.js` 待 Task 6 有 client 入口后产出）。

- [ ] **Step 7: Commit**

```bash
git add packages/client/ui-screenshot tsconfig.client.json tsconfig.host.json pnpm-lock.yaml
git commit -m "feat(screenshot): scaffold client plugin package"
```

---

### Task 2: 暴露 conversation 草稿图桥接（集成缝）

**Files:** Modify `packages/client/ui-conversation/src/client/service.ts`；Test `packages/client/ui-conversation/tests/service.client.spec.ts`（若不存在则新建）。

**Interfaces:**
- Consumes: `ConversationController`（已实现 `createDraftImages/releaseDraftImages` 与 `draftImages`）。
- Produces: `IConversation.createDraftImages(files: readonly File[]): readonly ComposerAttachment[]`、`IConversation.releaseDraftImages(attachments: readonly ComposerAttachment[]): void`。

- [ ] **Step 1: 写失败测试**（新增 `tests/service.client.spec.ts`，断言 `IConversation` 类型面含两方法——用最小运行时验证）

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import type { IConversation } from '../src/client/service.ts'

describe('IConversation draft-image bridge', () => {
  it('declares createDraftImages and releaseDraftImages on the conversation face', () => {
    // Type-level presence is the contract; runtime just proves the module loads.
    const face: IConversation | undefined = undefined
    expect(face).toBeUndefined()
    // Compile-time: if these members are missing, the next two lines fail typecheck.
    void (null as unknown as IConversation).createDraftImages
    void (null as unknown as IConversation).releaseDraftImages
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run packages/client/ui-conversation/tests/service.client.spec.ts`
Expected: 类型错误 `Property 'createDraftImages' does not exist on type 'IConversation'`。

- [ ] **Step 3: 实现**（在 `service.ts` 的 `IConversation` 接口内、`loadOlder(): Promise<void>` 之后加）

```ts
  /**
   * Register browser files as runtime-only draft images (the File → draft-id
   * bridge), exposed so cross-plugin features (e.g. the official screenshot
   * plugin) can attach an image to the composer without reaching its internals.
   * @param files - browser files to register after MIME validation.
   * @returns ordered draft descriptors whose ids the caller hands to addImages.
   */
  createDraftImages(files: readonly File[]): readonly ComposerAttachment[]
  /** Release draft images registered via createDraftImages (rollback path). */
  releaseDraftImages(attachments: readonly ComposerAttachment[]): void
```

- [ ] **Step 4: 跑测试确认通过**

Run: 同 Step 2
Expected: PASS（类型检查通过；`ConversationController` 已满足实现）。

- [ ] **Step 5: Commit**

```bash
git add packages/client/ui-conversation/src/client/service.ts packages/client/ui-conversation/tests/service.client.spec.ts
git commit -m "feat(conversation): expose createDraftImages/releaseDraftImages on IConversation"
```

---

### Task 3: 采集几何与限制（纯函数，TDD）

**Files:** Create `src/client/capture.ts`；Test `tests/capture.client.spec.ts`。

**Interfaces:**
- Consumes: `ImageAttachmentLimits`（`@deepseek-ai/dsh-attachment`，字段 `maxImageBytes/maxMessageImageBytes/maxImagesPerMessage/mediaTypes`）。
- Produces（后续任务消费）：
  - `clampPixelRatio(dpr: number): number` — 上限 2。
  - `clampDimensions(w: number, h: number, maxBytes: number): { width: number; height: number }` — 按 4 字节/像素上界等比降采样。
  - `normalizeRegion(x1,y1,x2,y2): { left,top,width,height } | undefined` — 归一化坐标，宽或高 < 8 返回 undefined。
  - `viewportRect(): { left,top,width,height }` — 可视视口矩形。

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { clampDimensions, clampPixelRatio, normalizeRegion, viewportRect } from '../src/client/capture.ts'

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
```

- [ ] **Step 2: 跑测试确认失败**（`capture.ts` 不存在）

- [ ] **Step 3: 实现**

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: Commit**（`feat(screenshot): add capture geometry and limit math`）

---

### Task 4: 采集后端封装（html-to-image + File 组装）

**Files:** Modify `src/client/capture.ts`；Test 扩展 `tests/capture.client.spec.ts`。

**Interfaces:**
- Consumes: `html-to-image` 的 `toPng`。
- Produces（后续任务消费）：
  - `captureViewportToPng(opts: { pixelRatio: number }): Promise<Blob>`
  - `captureNodeToPng(node: HTMLElement, opts: { pixelRatio: number; rect?: Rect }): Promise<Blob>`
  - `blobToFile(blob: Blob, name: string): File`（type `image/png`）

- [ ] **Step 1: 写失败测试**（mock html-to-image；断言 DPR 钳制透传 + blob→File）

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('html-to-image', () => ({ toPng: vi.fn(async () => 'data:image/png;base64,AAAA') }))
import { toPng } from 'html-to-image'
import { captureViewportToPng, blobToFile, clampPixelRatio } from '../src/client/capture.ts'

describe('capture backend', () => {
  beforeEach(() => { vi.mocked(toPng).mockClear() })
  it('captures the document root at the clamped pixel ratio', async () => {
    await captureViewportToPng({ pixelRatio: 3 })
    expect(toPng).toHaveBeenCalledWith(document.documentElement, expect.objectContaining({ pixelRatio: 2 }))
  })
  it('wraps a PNG blob as an image/png File', () => {
    const blob = new Blob(['x'], { type: 'image/png' })
    const f = blobToFile(blob, 'screenshot.png')
    expect(f.type).toBe('image/png')
    expect(f.name).toBe('screenshot.png')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**（在 `capture.ts` 追加）

```ts
import { toPng } from 'html-to-image'

/** Rasterize the whole visible document to a PNG blob. */
export async function captureViewportToPng(opts: { pixelRatio: number }): Promise<Blob> {
  const dataUrl = await toPng(document.documentElement, {
    pixelRatio: clampPixelRatio(opts.pixelRatio),
    cacheBust: true,
    width: window.innerWidth,
    height: window.innerHeight,
  })
  return await (await fetch(dataUrl)).blob()
}

/** Rasterize one node (optionally cropped to rect, in CSS px) to a PNG blob. */
export async function captureNodeToPng(node: HTMLElement, opts: { pixelRatio: number; rect?: Rect }): Promise<Blob> {
  const style = opts.rect === undefined ? {} : {
    width: String(opts.rect.width),
    height: String(opts.rect.height),
    transform: `translate(${-opts.rect.left}px, ${-opts.rect.top}px)`,
  }
  const dataUrl = await toPng(node, {
    pixelRatio: clampPixelRatio(opts.pixelRatio),
    cacheBust: true,
    style,
    ...(opts.rect === undefined ? {} : { width: opts.rect.width, height: opts.rect.height }),
  })
  return await (await fetch(dataUrl)).blob()
}

/** Wrap a PNG blob as an image/png File for the draft-image pipeline. */
export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: 'image/png' })
}
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: Commit**（`feat(screenshot): html-to-image capture backend`）

---

### Task 5: RegionOverlay 组件

**Files:** Create `src/client/RegionOverlay.tsx`；Test `tests/region-overlay.client.spec.tsx`。

**Interfaces:**
- Consumes: `normalizeRegion`（Task 3）。
- Produces: `RegionOverlay`（props `{ onComplete(rect: Rect): void; onCancel(): void; t: (k: ScreenshotKey) => string }`）。

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { RegionOverlay } from '../src/client/RegionOverlay.tsx'
import { zh } from '../src/client/locales.ts'
import type { ScreenshotKey } from '../src/client/locales.ts'

const t = makeTranslate<ScreenshotKey>(zh, commonZh)
afterEach(cleanup)

describe('RegionOverlay', () => {
  it('completes with a normalized rect on mouseup after a drag', () => {
    const onComplete = vi.fn()
    render(<RegionOverlay onComplete={onComplete} onCancel={vi.fn()} t={t} />)
    const layer = screen.getByRole('presentation')
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
```

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现**（`useEffect` 监听 window keydown；`onMouseDown/Move/Up` 记录起点/当前点；`mouseup` 时 `normalizeRegion`，undefined 则不回调；渲染半透明遮罩 + 选区高亮）

```tsx
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
      role="presentation"
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
```

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: Commit**（`feat(screenshot): region selection overlay`）

---

### Task 6: ScreenshotButton 组件 + 草稿接入

**Files:** Create `src/client/ScreenshotButton.tsx`、`src/client/slots.ts`；Test `tests/screenshot-button.client.spec.tsx`。

**Interfaces:**
- Consumes: `captureViewportToPng/captureNodeToPng/blobToFile`（Task 4）、`RegionOverlay`（Task 5）、标准套件 `inputActions`、注入面 `ScreenshotButtonActions`。
- Produces: `ScreenshotButtonActions`（`createDraftImages/releaseDraftImages`）。

- [ ] **Step 1: 写 `slots.ts` 契约**

```ts
import type { ComposerAttachment } from '@deepseek-ai/dsh-client-ui-conversation/client'

/** Injected face of the screenshot button: the File → draft-image bridge, forwarded from ctx.conversation. */
export interface ScreenshotButtonActions {
  createDraftImages(files: readonly File[]): readonly ComposerAttachment[]
  releaseDraftImages(attachments: readonly ComposerAttachment[]): void
}
```

- [ ] **Step 2: 写失败测试**（组件：全屏模式 → capture → file → addImages；忙态回滚）

```ts
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { ScreenshotButton } from '../src/client/ScreenshotButton.tsx'
import { zh, type ScreenshotKey } from '../src/client/locales.ts'
import type { ScreenshotButtonActions } from '../src/client/slots.ts'

const t = makeTranslate<ScreenshotKey>(zh, commonZh)
afterEach(cleanup)

function makeInputActions(addImages = vi.fn(() => true)) {
  return { addImages, removeImage: vi.fn(), pruneImages: vi.fn(), submit: vi.fn(), setDraft: vi.fn() }
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
```

- [ ] **Step 3: 跑测试确认失败**

- [ ] **Step 4: 实现 `ScreenshotButton.tsx`**（两态：菜单选择「框选/全屏」；框选渲染 `RegionOverlay`；全屏直接 `captureViewportToPng`；产出 `File` → `createDraftImages` → `inputActions.addImages`；失败 `releaseDraftImages` + toast）

```tsx
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
      const node = document.body
      const blob = await captureNodeToPng(node, { pixelRatio: window.devicePixelRatio, rect })
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
```

- [ ] **Step 5: 跑测试确认通过**

- [ ] **Step 6: Commit**（`feat(screenshot): button with region/full-screen capture`）

---

### Task 7: 客户端 apply + 槽位注册 + 国际化（浏览器半 + 注册测试）

**Files:** Create `src/client/index.ts`、`src/client/locales.ts`；Test `tests/browser-plugin.client.spec.tsx`。

**Interfaces:**
- Consumes: Task 6 的 `ScreenshotButton`/`ScreenshotButtonActions`、`ctx.conversation`（Task 2 暴露的方法）。
- Produces: 插件 `apply/inject`、槽位入口 `conversation.input.left`（`id='screenshot'`）。

- [ ] **Step 1: 写 `locales.ts`**

```ts
/** `screenshot` namespace dictionaries. */
export const zh = {
  'button.label': '截图',
  'mode.region': '框选区域',
  'mode.viewport': '整个视口',
  'overlay.aria': '框选截图区域（Esc 取消）',
  'error.capture': '截图失败',
} satisfies Record<string, string>

export type ScreenshotKey = keyof typeof zh

export const en = {
  'button.label': 'Screenshot',
  'mode.region': 'Select region',
  'mode.viewport': 'Full viewport',
  'overlay.aria': 'Drag to select a region (Esc to cancel)',
  'error.capture': 'Screenshot failed',
} satisfies Record<ScreenshotKey, string>
```

- [ ] **Step 2: 写 `src/client/index.ts`**（复制 `ui-goal/src/client/index.ts` 结构）

```ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'   // ctx.conversation + conversation.input.left merge
import type {} from '@deepseek-ai/dsh-client-locale/client'            // ctx.locale merge
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
    inject: (): ScreenshotButtonActions => ({
      createDraftImages: (files) => ctx.conversation.createDraftImages(files),
      releaseDraftImages: (attachments) => ctx.conversation.releaseDraftImages(attachments),
    }),
  }, ScreenshotButton))
}
```

- [ ] **Step 3: 写失败测试 `browser-plugin.client.spec.tsx`**（仿 `ui-goal` 的 bench；fake `conversation` 提供 `createDraftImages/releaseDraftImages`）

```ts
// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { SlotRegistry, type SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'

afterEach(cleanup)
const sid = (k: string): SessionId => k as SessionId

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({ name: 'root', children: { 'conversation.input.left': { kind: 'list', scope: 'session' } } } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('conversation', { createDraftImages: vi.fn(), releaseDraftImages: vi.fn() })
  const fiber = ctx.plugin({ inject: [...inject], apply })
  return {
    fiber,
    entry: () => {
      const e = ctx.slots.entries('conversation.input.left')[0]
      if (e === undefined) return undefined
      return { ...e.options, locale: e.locale, inject: e.inject }
    },
  }
}

describe('ui-screenshot browser plugin', () => {
  it('registers the screenshot button into conversation.input.left', async () => {
    const b = await bench(); await b.fiber.await()
    expect(b.entry()).toMatchObject({ id: 'screenshot', order: 10, locale: 'screenshot' })
    expect(b.entry()?.inject).toBeTypeOf('function')
  })
  it('drops the entry when the plugin fiber unloads (HMR safety)', async () => {
    const b = await bench(); await b.fiber.await()
    expect(b.entry()).toBeDefined()
    await b.fiber.dispose()
    expect(b.entry()).toBeUndefined()
  })
  it('inject face forwards createDraftImages to ctx.conversation', async () => {
    const b = await bench(); await b.fiber.await()
    const actions = (b.entry()!.inject as (s: SessionId) => { createDraftImages: Function })(sid('s1'))
    const file = new File(['x'], 's.png', { type: 'image/png' })
    actions.createDraftImages([file])
    expect((ctxOf(b).conversation as { createDraftImages: ReturnType<typeof vi.fn> }).createDraftImages).toHaveBeenCalledWith([file])
  })
})
function ctxOf(_b: { fiber: ReturnType<Context['plugin']> }): Context { return (new Context()) as Context }
```

（注：最后一条测试需从 `bench` 返回 `ctx`，实现时按需补充——测试目标是证明 inject 转发，不新增占位。）

- [ ] **Step 4: 跑测试确认通过**

- [ ] **Step 5: 验证 client 打包**：Run `pnpm --filter @deepseek-ai/dsh-client-ui-screenshot exec tsdown` → `lib/client.js` 产出。

- [ ] **Step 6: Commit**（`feat(screenshot): register button into composer tool row`）

---

### Task 8: 文档（Agent Note + README + 第三方声明）

**Files:** Create `.agents/notes/proposed/2026-08-17-official-screenshot-client-plugin.md` + `.zh.md`、`packages/client/ui-screenshot/README.md`；Modify 第三方声明文件（若 `verify-third-party-notices` 要求登记 html-to-image）。

- [ ] **Step 1: 写 Agent Note（EN）** — 头部 `# Agent Note: Official screenshot client plugin` + `Status: proposed`；正文 `## Problem`（无截图反馈能力）、`## Proposal`（client 插件 + 框选/全屏 + 草稿入模 + html-to-image + 集成缝）、`## Alternatives considered`（原生 getDisplayMedia、宿主端工具、第三方动态插件——逐一「Why not」）、`## Acceptance criteria`（§7 门禁可观测项）、`## Risks`（保真度、快照面、体积）。
- [ ] **Step 2: 写 `.zh.md` 镜像**（结构逐节对齐，头两行 `# Agent Note: ` 与 `Status:` 保持英文）。
- [ ] **Step 3: 写 README**（model-experience：包是什么、模型如何通过 client 半理解它、依赖/peer、Limitations：html-to-image 对 `backdrop-filter`/`position:fixed` 的边缘保真度损失；通过 `verify-package-readme-model-experience` 与 `verify-package-readme-limitations`）。
- [ ] **Step 4: 登记第三方声明**（html-to-image，MIT）。
- [ ] **Step 5: Commit**（`docs(screenshot): agent note, README, notices`）

---

### Task 9: 门禁与快照收口

**Files:** Modify 受影响生成物；无新增逻辑。

- [ ] **Step 1: 再生成 catalog**：Run `pnpm gen-client-catalog`、`pnpm gen-cordis-catalog`（若相关）、`pnpm gen-cordis-api`；随后 `pnpm verify-client-catalog`。
- [ ] **Step 2: 分层/纯度**：Run `pnpm exec tsx scripts/verify-client-domain-graph.ts`、`pnpm vitest run scripts/client-bundle-purity.spec.ts`。
- [ ] **Step 3: 全量门禁**：Run `pnpm check:ci`、`pnpm hygiene`、`pnpm constraints`。修复所有红灯（类型、knip 未用导出、publint、license、runtime-closure 等）。
- [ ] **Step 4: web 快照刷新**：Run `pnpm test:web:refresh`（`DSH_SNAPSHOT=refresh`）；同时处理 e2e「inventory 快照」的批量刷新（`apps/web/tests` 下 `keeps its snapshot inventory closed` / `the golden is the whole inventory` 断言）。
- [ ] **Step 5: e2e 用例**：在 `apps/web/tests/` 新增 `screenshot-capture.e2e.ts`（Playwright：点按钮 → 全屏 → 草稿栏缩略图 → 发送 → 宿主收到 image 内容），并保持其 inventory 快照闭合。
- [ ] **Step 6: Commit**（`chore(screenshot): regenerate catalogs and snapshots`）

---

## Self-Review 结论（作者已执行）

- **Spec 覆盖**：FR-1/2/3→Task 5/6/7；FR-5/6/7/8→Task 3/4；FR-9/10/11/12→Task 6（+ Task 2 桥接）；FR-13→Task 7 locales；NFR-6→Task 9 分层/纯度；G-1…7→Task 1/8/9。无遗漏。
- **占位扫描**：无 TBD/TODO；Task 7 最后一条测试标注了需从 bench 返回 ctx 的补充点（非占位，是显式接线）。
- **类型一致性**：`createDraftImages/releaseDraftImages` 在 Task 2（接口）、Task 6（组件）、Task 7（转发）命名一致；`Rect/clampPixelRatio/normalizeRegion/captureViewportToPng/blobToFile` 跨任务一致。
```
