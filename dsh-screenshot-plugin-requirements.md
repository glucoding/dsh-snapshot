# DSH 官方截屏插件 · 需求规约（SRS）

> 状态：已评审 v0.2（需求已锁定，待实现规划）
> 日期：2026-08-17
> 定位：官方（first-party / built-in）客户端插件，随 DeepSeek Harness 官方发布
> 读者：需求评审人、实现者、合入/发布 reviewer

---

## 1. 背景与目标

### 1.1 背景
DeepSeek Harness 已具备完整的多模态图片管线：
- 持久附件服务（`AttachmentStore`：`validateImage / commitImage / saveImage / readImage`，`ImageAttachmentRef`，`ImageAttachmentLimits`）；
- 宿主侧 `read_image` 工具（`packages/fs/tool-fs`）与模型"是否声明 image 输入"的严格路由门禁；
- 客户端草稿图栏（`ui-attachment` 原子 + `ConversationController.createDraftImages` → `InputActions.addImages` → 提交时 `serializeImages` 上传 → `{ type:'image', attachment }` 进入模型上下文）。

但当前**缺少**"用户把当前 harness 界面截图给模型"的能力：用户无法就界面上某处渲染（报错、图表、布局）向模型发起视觉反馈。

### 1.2 目标
交付一个**官方截屏客户端插件** `@deepseek-ai/dsh-client-ui-screenshot`：
1. 用户在 Web GUI 一键**框选区域**或**截取整个可视视口**；
2. 截图以 PNG 附加到当前会话**输入框草稿**（可删除/可续写）；
3. 用户发送时，图片随消息进入模型上下文（复用既有上传与门禁）。

### 1.3 官方定位（关键约束）
本插件是**官方内置插件**，而非第三方 opt-in 插件：
- 随官方 Web 前端构建与 `window.__DSH_BOOT__` 启动图**默认合入**（开箱即用）；
- 纳入 `release:dsh` 发布族，发布到 npm（`publishConfig.access: public`）；
- 通过仓库**全部**合入门禁（见 §7）。

---

## 2. 范围

### 2.1 在范围内
- 截取 harness 自身 Web 界面（可视视口 / 用户框选区域）；
- 附加到输入草稿、随下一条消息发给模型；
- 官方发布所需的全部工程化（包结构、清单、catalog、测试、文档、i18n、门禁）。

### 2.2 不在范围内（明确排除）
- 宿主桌面/窗口/多显示器屏幕采集（computer-use 式）；
- 无头浏览器打开外部 URL 截取网页；
- 视频录制 / GIF / 长图全页滚动拼接；
- 宿主侧新增 `screenshot` 工具（这是纯 client 插件）；
- 截图的云端存储/图床/分享链接。

---

## 3. 术语与约定

| 术语 | 含义 |
|---|---|
| client 插件 | `packages/client/ui-*`，导出 `apply(ctx)/inject/name`，通过 `ctx.slots.register` 挂 UI，`lib/client.js` 为浏览器半 |
| 槽位（slot） | 客户端 UI 扩展点，`ctx.slots.register(options, Component)` 贡献组件 |
| 草稿图（draft image） | 未发送的浏览器本地图片，`DraftAttachmentId` + 缩略图 URL，存于 `ConversationController` |
| boot 图 | `window.__DSH_BOOT__`，由 `packages/client/modules` 依据各包 `dsh.client` 声明自动合成 |
| CaptureBackend | 采集后端接口（默认 html-to-image，可替换为原生 `getDisplayMedia`） |

---

## 4. 功能性需求（FR）

> 编号规则：FR-x.y；"必须/应当/可以"分别对应 MUST / SHOULD / MAY。

### 入口与交互
- **FR-1（必须）** 在 composer 工具行左端（槽位 `conversation.input.left`，`list`/`session`）挂一个截图按钮：图标 + 可访问标签 + 键盘可达。
- **FR-2（必须）** 点击进入选择态，提供两种模式：**框选区域** 与 **一键全屏（可视视口）**。默认推荐框选为主、全屏为次级入口。
- **FR-3（必须）** 框选态：拖拽画矩形，`Esc` 或右键取消；选区小于 8×8px 时忽略并提示。
- **FR-4（应当）** 无 `attachments` 服务或 `imageLimits` 缺失时，禁用并隐藏入口（当前部署不支持图片）。

### 采集
- **FR-5（必须）** 默认采集后端为 **html-to-image（SVG foreignObject）**：按选区 DOM 矩形（或 `document.documentElement` 视口）栅格化为 PNG。
- **FR-6（必须）** 像素比取 `devicePixelRatio`，上限 2（防止超大图/超限）。
- **FR-7（必须）** 采集期间隐藏截图按钮与框选遮罩自身，避免截进图里。
- **FR-8（应当）** 采集封装为 `CaptureBackend` 接口，保留将来接入原生 `getDisplayMedia` 的升级点（默认不启用）。

### 入草稿与限制
- **FR-9（必须）** 产出 `File(blob, 'screenshot-<ts>.png', { type:'image/png' })` → `ctx.conversation.createDraftImages([file])` → `inputActions.addImages(ids)`；`addImages` 返回 `false`（裁决/提交忙态）时立即 `releaseDraftImages` 回滚。
- **FR-10（必须）** 遵守 `imageLimits`：`mediaTypes` 固定 `image/png`；预检 `maxImageBytes` / `maxMessageImageBytes` / `maxImagesPerMessage`，超限则降采样或报错（复用既有 `attachmentErrorText` 文案口径）。
- **FR-11（必须）** 成功后草稿栏出现缩略图；用户可删除/续写；发送走既有 `serializeImages` 上传与模型图像门禁，不新增规则。
- **FR-12（必须）** 采集/序列化失败（外部图片/字体 CORS 污染、序列化异常）时 toast 报错，不留脏草稿。

### 国际化与配置
- **FR-13（必须）** 全量文案 EN + zh，走 `client/locales.ts` 命名空间 + `locale` 服务。
- **FR-14（首版不做）** 首版不提供设置开关（YAGNI），插件默认开启；后续如需关闭再引入设置项。

---

## 5. 非功能性需求（NFR）

- **NFR-1 保真度**：对会话界面（文本、代码块、KaTeX、mermaid、渐变）渲染可接受；已知 `backdrop-filter`/个别 `filter`/`position:fixed` 子树存在边缘保真度损失，需在 README「Limitations」记录。
- **NFR-2 性能**：点击到草稿栏出现缩略图体感 < 500ms；栅格化不长时间阻塞主线程；DPR 上限 2。
- **NFR-3 无障碍**：键盘可达、`Esc` 取消、焦点管理、ARIA 标签。
- **NFR-4 安全/隐私**：仅采集本页 DOM，不访问宿主屏幕/剪贴板/网络外发；图片仍受 attachment 尺寸/类型门禁。
- **NFR-5 体积**：`html-to-image` 被打包进 `lib/client.js`；若首屏体积超预算，评估按需动态加载。
- **NFR-6 可维护性**：内部遵循 client 域分层（`contract/` 共享契约 + 各 domain + `apply.ts`/index 装配），通过 `verify-client-domain-graph` 与 `client-bundle-purity`。

---

## 6. 架构与集成约束（技术规约）

### 6.1 包结构与清单
- 位置/命名：`packages/client/ui-screenshot`，包名 `@deepseek-ai/dsh-client-ui-screenshot`。
- `package.json` 必备字段（对齐 `ui-goal`）：
  - `exports["./client"]` → `{ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" }`；
  - `dsh.client = { platform: "web", inject: [...] }`（这是进入 boot 图的唯一声明，`immediately` 省略，即非首屏立即加载）；
  - `scripts.bundle = tsdown`、`scripts.watch = tsdown --watch`；
  - `files` 含 `lib/index.js`、`lib/invariant.js`、`lib/client.js`、`lib/types/**/*.d.ts`；
  - `publishConfig.access = public`、`license: MIT`、`repository.directory`；
  - `dependencies` 含 `html-to-image`；`peerDependencies` 含 `@deepseek-ai/cordis`、`react` 及所依赖的 `@deepseek-ai/dsh-client-*`（`workspace:^`）。

### 6.2 依赖（`dsh.client.inject` 与 cordis `inject`）
- `dsh.client.inject` 至少含：`@deepseek-ai/dsh-client-ui-conversation`（槽位 + `ctx.conversation` 服务 + 标准套件）、`@deepseek-ai/dsh-client-runtime`（`ClientContext`/会话投影）、`@deepseek-ai/dsh-client-locale`（i18n）。`imageLimits` 投影来源在实现期确认（沿用 InputBar 的 `useProjection('imageLimits')` 通道）。
- cordis 插件 `inject` 含 `slots`（槽位注册）与 conversation 服务；所有注册包在 `ctx.slots.inject(key, () => ctx.slots.register(...))` 内。

### 6.3 集成缝（对既有代码的唯一侵入）
- 在 `packages/client/ui-conversation/src/client/service.ts` 的 `IConversation` 类型面暴露 `createDraftImages(files)` 与 `releaseDraftImages(attachments)`（二者在 `ConversationController` 上已是 public 实现，仅需类型暴露 + 注释，约 2 行级改动）。插件不侵入 composer 内部。

### 6.4 槽位注册
- 按钮注册进 `conversation.input.left`（`list`/`session`，`id` 自取、`order` 控制位置）；组件经标准套件拿到 `sessionId`/挂载的 `inputActions`。
- 槽位声明必须带注册者视角 JSDoc（`gen-client-catalog` 会校验），并触发 `slot-catalog.ts` 与 client catalog 再生成。

---

## 7. 官方发布 / 合入门禁（Acceptance Gates）

> 以下为"官方发布"的**硬性**通过标准，全部绿灯方可合入与发布。

- **G-1 发布族**：纳入 `release:dsh` 家族，版本与 monorepo 对齐（`0.1.0-rc.x`），`publishConfig.access: public`。
- **G-2 代码门禁**：`pnpm check:ci` 全绿；`pnpm hygiene`（`rescope-vendor`、`knip`、`publint`、`constraints`、`verify-dsh-package-licenses`、`verify-package-invariants`、`verify-built-package-invariants`、`verify-cordis-config`、`verify-node-next-types`、`verify-runtime-closure`、`verify-vendored-links`）全绿。
- **G-3 catalog/图门禁**：`gen-client-catalog`（`--check`）与 `gen-cordis-catalog`、`verify-client-domain-graph`、`client-bundle-purity` 全绿；boot 图由 `dsh.client` 声明自动合成，无需手改 `packages/client/modules`。
- **G-4 测试门禁**：
  - 单元（vitest）＋ 客户端 GUI（`test:gui`，testing-library）；
  - e2e（Playwright，`apps/web/tests`）；
  - `test:web`（构建后 web 测试）与 web 快照（`DSH_SNAPSHOT=refresh` 刷新）；**注意**：新增官方插件会改变所有 e2e 的「plugin inventory 快照」，需批量刷新/录制的机械性迁移。
- **G-5 文档门禁**：feature 类 Agent Note（EN + `.zh.md`，先 `proposed/`）；README 满足 `verify-package-readme-model-experience` 与 `verify-package-readme-limitations`；官网（VitePress）收录。
- **G-6 i18n 门禁**：EN + zh 文案齐全，通过 `verify-translation-pairing` 等相关检查。
- **G-7 依赖门禁**：`html-to-image`（MIT、零运行时依赖、无 install 脚本）通过 license/rescope/constraints/knip/publint/runtime-closure，并在 `third-party notices` 登记。

---

## 8. 验收标准（可观测）

- 官方 Web 构建启动后，composer 工具行左端可见截图按钮；点击 → 框选/全屏 → 草稿栏出现缩略图。
- 发送后，宿主日志/回放中该消息含 `image` 内容块，且通过模型图像能力门禁；非图像模型给出既有拒绝文案。
- `Esc` 取消框选、忙态 `addImages=false` 回滚、超限报错均无脏状态残留。
- §7 所有门禁命令在 CI 中绿灯；Agent Note/README/官网/i18n/第三方声明齐全。

---

## 9. 风险与假设

- **R1 保真度**：html-to-image 对个别高级 CSS 有边缘损失；缓解=README 记录 limitations + 预留原生后端升级点。
- **R2 快照迁移面**：新增官方插件将大范围改变 web/e2e「inventory」快照与 `__DSH_BOOT__` 相关断言，属机械性但量大的迁移。
- **R3 依赖体积**：`html-to-image` 增加 `lib/client.js` 体积；缓解=必要时按需加载，超预算则回退原生方案 B。
- **R4 合入位置（已决议）**：授权写入 checkout `E:\dskharness\deepseek-harness`（选项 a）。实现阶段首次写 checkout 会触发一次提权审批（danger-full-access）；实现前的文档/计划仍先落 `E:\dsh-snapshot`。
- **假设 A1（已决议）**：官方内置**默认开启**；首版无设置开关。
- **假设 A2**：截取对象为 harness 自身 Web 界面（非宿主屏幕、非外部网页）。

---

## 10. 已决议（Resolved）

1. **合入位置**：授权写入 checkout `E:\dskharness\deepseek-harness`（选项 a）；实现期首次写 checkout 触发一次提权审批。
2. **默认开关**：官方内置默认开启；首版不提供设置开关（YAGNI）。
3. **按钮位置**：composer 工具行左端（`conversation.input.left`）——已接受。
4. **采集依赖**：新增 `html-to-image`——已接受。

---

## 11. 变更记录

| 版本 | 日期 | 说明 |
|---|---|---|
| v0.1 | 2026-08-17 | 初稿：调研结论 + 功能/非功能需求 + 官方合入门禁，待评审 |
| v0.2 | 2026-08-17 | 评审通过：锁定合入位置(授权写 checkout)、默认开启、按钮位置、html-to-image 依赖 |
