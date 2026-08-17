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
