# W5 迁移：视频播放器（chips.official.video-player）第③段开发日志

> 日期：2026-10-01
> 任务：派单行表 #5——迁移 10 行（播放 hook 族 + 格式表，控制 UI 重写，preferences 换 `config:*` 降级内存态）；本臂不做端到端（候 `resource:open` video 槽位与 config 域宿主处理器）。
> 包：`chips-ecosystem/plugins/apps/video-player/`（分支「第五次重构」，全程零 git 写操作）
> 母型：`plugins/basecards/music/`（纯逻辑迁移 + 夹具纪律）、#257 grid 包纪律、骨架 `src/commands/appCommands.ts` 形制。

---

## 一、交付清单（矩阵行 × 落点）

| 矩阵行（四媒体查看器仓 §五） | 判定 | 落点 | 说明 |
|---|---|---|---|
| 播放状态机（usePlaybackEngine.ts:390） | 迁移 | `src/player/usePlaybackEngine.ts` | 逐行保真迁移；导入路径适配；两处注释化收口（见 §三.1） |
| 轨道（useTracks.ts:201） | 迁移 | `src/player/useTracks.ts` | 保真迁移；TextTrackList 事件挂接收口为可选调用（受限媒体栈安全，§三.2） |
| 全屏/PiP（useFullscreen.ts:128） | 迁移 | `src/player/useFullscreen.ts` | 保真迁移；类型面收口为注解式（lint no-unnecessary-type-assertion） |
| 键位（usePlayerKeyboard.ts:136） | 迁移 | `src/player/usePlayerKeyboard.ts` | 保真迁移；`isEditableTarget` 严格布尔收口（jsdom 非可编辑元素 `isContentEditable` 非布尔） |
| 自动隐藏（useChromeVisibility.ts:98） | 迁移 | `src/player/useChromeVisibility.ts` | 保真迁移 |
| 播放参数与格式表（video-player.ts:245） | 迁移 | `src/player/videoPlayer.ts` | 唯一旧 SDK 触达点收口：`import type VideoCardOpenPayload` → 本地 `IVideoCardPlayback`（《01-卡片文件格式》§6.2 `playback` 段 snake_case 字段为权威）；新增 `createVideoSourceFromUri`（会话装配面，URI 展示名解码） |
| 偏好持久化（preferences.ts:63） | 重写 | `src/player/preferences.ts` | localStorage 旁路不复活；`VideoPlayerPreferenceStore` 接口 + 窗口会话内存态实现（工单066）；语义保留判例随迁（音量钳制、倍速白名单、非法字段保留现值） |
| 控制器（useVideoPlayerController.ts:296） | 重写 | `src/player/useVideoPlayerController.ts` | 组合迁移 hook 族；偏好写入收敛到存储接口；载荷入口参数优先于偏好（§三.3） |
| 控制 UI 全族（Stage 1003/Timeline/TrackMenu/Osd/EndedOverlay/EmptyState/KeyHelpDialog + 8 CSS） | 重写 | `src/ui/`（AppView/PlayerStage/ControlsBar/MorePanel/KeyHelpDialog/EmptyState）+ `src/messages.ts` | `@chips/ui` 唯一导入面（antd 6.6.4-chips.1 fork 转发白名单 + @ant-design/icons 整集）；样式全 token（`theme.useToken`），零独立 CSS；文案简体中文直写（R5）；osd/timeline 交互语义按《03-查看器设计》§十保留 |
| 测试 | 迁移/重写 | `tests/`（10 文件 67 用例） | 随迁判例：`video-player.test`（格式表）、`tracks.test`（轨道/全屏纯函数，旧 controller.test 判例）、`preferences.test`（语义保留）、`playback-engine.test`/`player-keyboard.test`/`chrome-visibility.test`（hook 族）、`__animation-events` 夹具并入 `tests/setup.ts`；重写件测试：`controller.test`、`commands.test`、`app-view.test`、`app.test`（骨架保持） |

测试素材规范（四媒体 G-5）：本包测试零外部素材路径依赖，媒体面全部以 mock 元素注入（无 `ProductFinishedProductTestingSpace` 触达）。

## 二、命令注册面（与 manifest 逐字对应）

- `video-player:open-card` / `video-player:refresh-view`：manifest `cli.commands` 两入口保持；`appCommands.ts` 元数据（title/description）与清单逐字对应（锁测：`commands.test` 的 MANIFEST_CLI_COMMANDS 对照）。
- 播放控制命令族新增 8 条（toggle-playback / seek-forward / seek-backward / toggle-mute / cycle-playback-rate / toggle-loop / toggle-fullscreen / toggle-picture-in-picture）：ui 目标、`handlerId` 配对、《13-命令系统契约》§2.1 文法、简体中文文案、播放控制/画面分组。**不进 manifest `cli.commands`**（CLI 消费入口语义不适用），**不声明 `shortcut`**：窗口内键位由迁移 hook 承载，待平台窗口级快捷键派发通道交付后按 §5.5 迁移为命令记录绑定，避免双重绑定回潮。
- 动作表经 `resolveActions()` 现取（渲染对象按渲染换代，注册 effect 幂等装配一次）；动作缺位静默跳过（空态派发无效应），执行记录照常上报。`command:*` 宿主处理器缺位期间注册失败收敛为「命令通道异常」状态行，界面/键位照常工作（诚实降级，不假接线）。

## 三、迁移保真修复与收口记录（判迁移 ≠ 复刻缺陷）

1. **会话复位携偏好**：旧引擎会话复位 effect `setState(createPlaybackState(hints))` 丢偏好参数，与同依赖序的参数回放 effect 构成「元素含偏好、状态回默认」双轨不一致（旧仓潜在缺陷）。已修复为 `createPlaybackState(hints, preferences)`，判例随迁锁定。
2. **TextTrackList 可选事件面**：jsdom 与受限媒体栈的 `textTracks` 缺 `addEventListener`，挂接收口为可选调用（真浏览器全量可用，语义不变）。
3. **载荷参数优先级**：控制器按《10-设计》§3.3 口径——卡片 `playback` 段是本次打开的入口参数（优先），用户偏好兜底；偏好快照按会话取值，用户操作即时回写。
4. **`openVideoInput` 空态装配**：本臂无端到端投递，空态以直播地址输入承载（`isDirectPlayableUri`/`isSupportedVideoResource` 守卫，本地文件按扩展名如实提示不支持格式；远端交宿主媒体栈判定）。不自建文件选择旁路（`dialog:*` 域宿主面同样缺位，调用即拒）。

## 四、诚实降级与工单

- **工单066**（本次升单登记）：`config:*` 域宿主处理器缺位（bridge 契约 :104-107 在册、宿主 `capabilities/` 仅 document 域），偏好持久化降级为窗口会话内存态；`VideoPlayerPreferenceStore` 接口收口待换接。README「已登记缺位」节同步。
- 命令通道降级：同 §二（骨架既有口径，保持）。
- 零绕过声明：无 localStorage/sessionStorage 旁路、无占位实现、无 TODO；UI 空态/错误态/命令态全部如实呈现。

## 五、验证（亲跑，2026-10-01）

- `pnpm exec vitest run`：**10 文件 67 用例全绿**（含 jsdom 环境迁移判例）；
- `pnpm exec tsc -p tsconfig.json --noEmit`：零错误（`exactOptionalPropertyTypes` 面收口）；
- `pnpm exec eslint src tests`：零错误零警告；
- `pnpm run build`：`dist/index.js` 0.22 kB + `render.js` 60.31 kB（vendor 外部化，红线守卫通过）；
- FORBIDDEN_ANTD_EXPORTS 机检（词界双验法）：A 面 antd/`@chips/antd` 导入零命中；B 面 28 名词界扫描唯一命中 `message`，逐条溯源均为 `ViewerFeedback` 载荷字段与局部变量（勘误四类误报源之「载荷字段」），零静态实例通道、零禁面组件触达。
- 未跑 `gates:all`（按派单约束）。

## 六、边界与后续（候裁/候波次，不代裁）

1. `resource:open` video 槽位端到端（启动投递 → `VideoSource` 会话装配）候宿主资源打开路由（工单060~064 同源）；落波后 `AppView` 增投递消费臂，`createVideoSourceFromUri` 复用。
2. config 域处理器落波后偏好翻正（工单066 期望面）。
3. `command:*` 宿主派发通道交付后：播放控制命令按需迁移 `shortcut` 绑定（§二）。
4. 《09-官方插件与应用目录》§7.2 video-player 行状态翻正（已设计 → 已迁移）候端到端臂收口时随批办理（工单060 判例：应用行翻正与端到端就绪同步，本臂不代改）。
5. 渲染帧插件执行通道（#85/工单025）不影响本应用（app 表面为窗口级，非帧内渲染）。
