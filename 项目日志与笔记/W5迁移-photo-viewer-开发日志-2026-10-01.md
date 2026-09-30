# W5 迁移：图片查看器（chips.official.photo-viewer）第③段开发日志

> 日期：2026-10-01
> 任务：W5 应用迁移三段式第③段——图片查看器业务迁移（派单行表 #3，勘查处方：迁移 2 文件 + 测试随迁，壳/舞台重写，manifest image 槽 primary；骨架第②段已四闸绿）
> 旧仓（只读冻结）：`Chips-PhotoViewer/`（64 行已清）；矩阵：`项目日志与笔记/重构计划/旧功能覆盖矩阵-四媒体查看器仓-2026-09-20.md` §四（grep PhotoViewer 逐行裁决照办）
> 独占目录：`chips-ecosystem/plugins/apps/photo-viewer/`（零 git 写操作；命令一律 `npx -y pnpm@9 <cmd>`）

## 一、迁移裁决执行（对照矩阵 §四逐行）

| 矩阵行 | 判定 | 本路落点 |
|---|---|---|
| 缩放/平移/旋转数学 `src/utils/image-viewer.ts:204` | 迁移 | `src/viewer/image-viewer.ts` 纯函数逐字随迁（引号/导入适配），含 SUPPORTED_IMAGE_EXTENSIONS 表；`tests/image-viewer.test.ts` 旧 `tests/unit/image-viewer.test.ts` 断言逐条随迁（14 例） |
| 相机交互状态机 `src/hooks/usePhotoViewerCamera.ts:624` | 迁移 | `src/viewer/usePhotoViewerCamera.ts` 行为逐条等价随迁；装配层由组件内函数声明适配为 `useCallback`（行为不变，react-hooks/exhaustive-deps 零告警）；`tests/usePhotoViewerCamera.test.tsx` 8 例（fit/manual、步进钳制、旋转换轴、会话重置、双击切换、导航通道） |
| 应用壳/舞台/组件族（AppRuntimeProvider:985、AppShell、PhotoViewerStage:321、Filmstrip、InfoPanel、NavigationArrows、ZoomBadge、EmptyState、ViewerContextMenu、global.css:629 等） | 重写 | R2/R4 全落：壳/舞台以 `@chips/ui`（antd 白名单转发）+ theme token 重写（`PhotoStage`/`ViewerDock`/`Filmstrip`/`InfoPanel`/`AppView`），零硬编码 CSS（全内联 token 样式）、零 i18n key 层（简体中文直写）、零 ConfigProvider/message 直引（`ChipsProvider`/`ChipsThemeRoot` 承担、反馈走行内反馈条）；右键菜单（antd Dropdown contextMenu）与胶片条语义按《03-查看器设计》§三/§四/§十/§十一 重建 |
| 打开投递与图包载荷 `src/utils/launch-resource.ts:221` | 重写 | `src/viewer/openQueue.ts`：旧 PlatformLaunchContext 解析面作废，按《14》§5.1/§5.2/§5.4 重建——`IResourceOpenContext` 单图主资源 + `chips.book-card` image-sequence 载荷建队（版本主版本兼容判定、主资源命中定位、relativePath 仅展示不读取）；`tests/openQueue.test.ts` 12 例 |
| 保存副本（旧 client.file.write/copy） | 重写 | `dialog:save` + `file:write`（base64；临时文件 + 原子替换在能力侧），成功/取消/失败三分反馈；**tiff/heic 归一不在本包**（见 §二） |
| manifest | 重写（第②段已定） | 第②段 canonical 面零改动；仅按契约补申请侧权限：`dialogs:use`（04.14）、`filesystem:write:${userHome}`（04.08 路径限定值必填，写法对齐 icon-maker 判例）——保存副本两能力的 R19 映射所需 |
| 启动器图标 | 迁移 | 第②段已落 `assets/icons/app.svg`，零改动 |
| 测试 | 重写 6 / 随迁 1 | 见 §四 |

## 二、tiff/heic 与 content-image 裁决（派单前置件核对结论）

- 派单行「tiff/heic 归一走已交付 `plugins/services/content-image`」核对结论：**本包零 tiff/heic 分支**。旧仓 src grep `tiff|heic` 零命中；《03-查看器设计》§8.2 明定图片查看器覆盖 png/jpg·jpeg/webp/gif/bmp/svg/avif，未覆盖格式（tiff/heic 等）由万能文件查看器兜底，本包 manifest 支持表与之一致——归一化入参在本包边界内不存在，若引入即无源之水。
- `content-image` 服务实读：`chips.service.content-image` 当前仅交付 `pickColors`；`content-image.normalize`/`transcode` 为「提供方在册缺位」（`plugins/services/content-image/src/plugin.ts` 头注），本臂未消费、未假接线。若未来图片查看器扩格式，归一走服务间内核路由正式面（本包为 app 角色，经 `ctx.bridge`/`chips.request` 契约面，禁直接 import 服务内部模块）。

## 三、架构与诚实降级登记

1. **运行中投递（正式面已接）**：UI 经 `chips.subscribe('resource:opened')` 消费（14 §5.5「UI 经 chips.subscribe」），按 `pluginId` 定向过滤，假桥全链测试验证。
2. **打开臂（正式面真调 + 降级提示）**：空态按钮 / dock「打开图片」/ `Ctrl+O` → `dialog:open` → `chips.request('resource:open', { intent:'view', resource:{…} })` 请求 image 槽位；宿主未就绪（`CAPABILITY_UNAVAILABLE` 等）时行内简体中文提示并透出错误码，零假成功（工单063）。
3. **保存副本**：同上，`file:write` 失败行内透错误码；用户取消给 info 反馈非错误。
4. **字节读取**：`chips.resource(uri)` 句柄 `read()`，`RESOURCE_TOO_LARGE` 按《15》§五降级 `stream()` 合并；远程 http(s) 引用交 `<img>` 原生加载。展示 URL 缓存按 uri（Blob 生命周期随会话释放）。
5. **新增工单066**：应用窗口运行时装载 render.js 与初始上下文投递通道缺位（`shell-window.ts:7` 诊断壳头注为证；《14》§5.1 初始上下文到主逻辑后无 UI 通道）——本包 UI 以空态如实等待运行中投递，不伪造初始查看内容、不经 `window.location` 等非正式通道自造上下文。已登记 `项目日志与笔记/工单066-应用窗口运行时与启动上下文投递缺位/` 并入册《问题工单.md》；工单063 追加落波进展补记。
6. 命令面零改动：`photo-viewer:open-card`/`refresh-view` 元数据与 manifest 逐字对应（骨架既有），UI attach 处理器接业务效应（refresh→重读当前图；open-card→路径经 resource:open 正式面）。

## 四、测试（先测后码，50 例全绿）

- `tests/image-viewer.test.ts`：14 例（旧仓断言逐条随迁）。
- `tests/openQueue.test.ts`：12 例（单图/图包载荷/版本兼容/relativePath 边界/MIME 推断）。
- `tests/usePhotoViewerCamera.test.tsx`：8 例（相机状态机行为）。
- `tests/stage.test.tsx`：7 例（AppView + 注入假桥集成：空态、单图投递建队、读图失败重试、图包导航、保存副本成功/失败、滚轮缩放→徽标 127%）。
- `tests/commands.test.ts`（骨架保留 5 例）+ `tests/app.test.ts`（launch 标题/来源日志/openFile 标题 3 例）。
- 测试环境：jsdom + `tests/setup.ts` 平台面补充桩（matchMedia/ResizeObserver/createObjectURL，同 basecards/image 判例；不 mock 业务行为）；vitest.config 对齐 basecards/image 包级判例（react 去重 + inline 依赖）。

## 五、四闸与校验（亲跑）

| 闸 | 结果 |
|---|---|
| `test`（vitest run） | 6 文件 50/50 通过 |
| `typecheck`（tsc --noEmit） | 通过 |
| `lint`（eslint src tests） | 0 错 0 警 |
| `build`（vite main + render） | dist/index.js 0.82 kB + render.js 58.53 kB（vendor 外部化，零 antd 直引） |
| cpk 五阶段（`chips plugin pack`） | 通过（photo-viewer-0.1.0.cpk，60.3 KiB，校验通过） |
| FORBIDDEN_ANTD_EXPORTS 词界双验 | 零真实命中（`message`/`version` 命中均为载荷字段与反馈消息字段，A 面 antd 导入零命中） |

依赖变更：仅 devDependencies 增 `jsdom@28.1.0`（对齐 basecards/image 既有选型，纯测试环境用途）。

## 六、文档与台账随动

- 《09-官方插件与应用目录》§7.2 photo-viewer 行：已设计 → 已迁移（打开臂端到端与初始上下文投递待工单063/066 宿主面），补实现路径。
- 包 README：业务结构、正式链路、已登记缺位重写。
- 《问题工单.md》：新登 066；063 追加落波进展补记。
- 本日志即派单指定过程材料；未动旧仓与骨架既定 canonical 面（fileAssociations/cli.commands/ui.surface 零改动）。

## 七、遗留与后续

1. 工单063（宿主 resource:open 路由与处理器注册）收口后：打开臂端到端、图片卡片「查看大图」全链回填，本包零改动。
2. 工单066（应用窗口运行时）收口后：初始上下文 → `resolveImageQueue` 建队零改动回填。
3. 外部文件拖入窗口臂未实现：拖放入窗归属《02-拖动规范》§6 与宿主窗口波，本臂未声明、未假接。
4. dock 窄窗「更多」折叠（03-设计 §3.1 溢出规则）随窄窗响应式波次补齐，当前以横向滚动兜底不折叠关键操作。
